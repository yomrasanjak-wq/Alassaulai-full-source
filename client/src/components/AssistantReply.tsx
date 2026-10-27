import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Volume2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

type VoiceGender = "male" | "female";
type AssistantReplyProps = { text: string; language: "AR" | "TR" | "EN"; autoSpeak?: boolean; voiceGender?: VoiceGender };

const speechLanguage: Record<AssistantReplyProps["language"], string> = { AR: "ar-SA", TR: "tr-TR", EN: "en-US" };
const femaleVoiceHints = ["female", "woman", "girl", "saba", "laila", "zira", "hoda", "heba", "layla", "فاطمة", "ليلى", "هدى", "أنثى", "امرأة"];
const maleVoiceHints = ["male", "man", "boy", "adam", "khalid", "khaled", "zira", "maged", "tarik", "naayf", "hamed", "hamad", "fahd", "omar", "yousef", "hisham", "abdul", "خالد", "آدم", "ذكر", "رجل"];

function isMaleVoiceName(name: string) {
  const normalized = name.toLowerCase();
  if (["female", "woman", "girl", "saba", "laila", "zira", "hoda", "فاطمة", "ليلى", "أنثى", "امرأة"].some((hint) => normalized.includes(hint))) return false;
  return maleVoiceHints.some((hint) => normalized.includes(hint));
}

function chooseVoice(language: string, gender: VoiceGender, voices: SpeechSynthesisVoice[]) {
  const normalizedLanguage = language.toLowerCase();
  const exact = voices.filter((voice) => voice.lang.toLowerCase() === normalizedLanguage);
  const sameLanguage = voices.filter((voice) => voice.lang.toLowerCase().startsWith(normalizedLanguage.slice(0, 2)));
  const candidates = exact.length ? exact : sameLanguage.length ? sameLanguage : voices;
  if (!candidates.length) return undefined;
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    const female = femaleVoiceHints.some((hint) => name.includes(hint));
    const male = isMaleVoiceName(name);
    if (gender === "male" && female) return -100;
    if (gender === "female" && male) return -100;
    return (voice.lang.toLowerCase() === normalizedLanguage ? 40 : 20) + (gender === "male" ? (male ? 60 : 0) : female ? 60 : 0);
  };
  return candidates.map((voice) => ({ voice, score: score(voice) })).sort((a, b) => b.score - a.score)[0]?.voice;
}

function cleanSpeechText(text: string) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/https?:\/\/\S+/g, "").replace(/[*_#`]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/\s+/g, " ").trim();
}

function splitSpeechChunks(text: string, maxLen = 220) {
  const sentences = text.match(/[^.!؟?。۔]+[.!؟?。۔]*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > maxLen) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

function speakChunked(text: string, language: AssistantReplyProps["language"], gender: VoiceGender, onStart: () => void, onEnd: () => void) {
  if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined" || !window.speechSynthesis) return undefined;
  const synthesis = window.speechSynthesis;
  const chunks = splitSpeechChunks(text);
  let index = 0;
  let cancelled = false;
  let started = false;
  const finish = () => { if (!cancelled) onEnd(); };
  const speakNext = () => {
    if (cancelled || index >= chunks.length) { finish(); return; }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.lang = speechLanguage[language];
    utterance.rate = language === "AR" ? (gender === "male" ? 0.96 : 0.98) : 1;
    utterance.pitch = gender === "male" ? 0.88 : 1.08;
    const voice = chooseVoice(utterance.lang, gender, synthesis.getVoices());
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { if (!started) { started = true; onStart(); } };
    utterance.onend = () => { index += 1; speakNext(); };
    utterance.onerror = finish;
    synthesis.speak(utterance);
  };
  const begin = () => {
    if (cancelled) return;
    synthesis.resume();
    speakNext();
  };
  if (synthesis.getVoices().length > 0) begin();
  else synthesis.addEventListener("voiceschanged", begin, { once: true });
  return () => { cancelled = true; };
}

export function AssistantReply({ text, language, autoSpeak = true, voiceGender = "male" }: AssistantReplyProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const browserCancelRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef(0);
  const speechMutationFactory = trpc.ai.speech?.useMutation;
  const speechMutation = speechMutationFactory ? speechMutationFactory() : undefined;
  const speechMutateAsyncRef = useRef(speechMutation?.mutateAsync);
  speechMutateAsyncRef.current = speechMutation?.mutateAsync;
  const voiceGenderRef = useRef(voiceGender);
  voiceGenderRef.current = voiceGender;

  const clearAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  const stopSpeaking = useCallback(() => {
    sessionRef.current += 1;
    browserCancelRef.current?.();
    browserCancelRef.current = null;
    clearAudio();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, [clearAudio]);

  const playAudioQueue = useCallback(async (audioContents: string[], mimeType: string, session: number) => {
    for (const content of audioContents) {
      if (session !== sessionRef.current) return;
      const bytes = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      objectUrlsRef.current.push(url);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Audio playback failed"));
        void audio.play().catch(reject);
      });
    }
  }, []);

  const speak = useCallback(async () => {
    const spokenText = cleanSpeechText(text);
    if (!spokenText) return;
    stopSpeaking();
    const session = sessionRef.current;
    try {
      const mutateSpeech = speechMutateAsyncRef.current;
      if (!mutateSpeech) throw new Error("NO_GOOGLE_KEY_USE_BROWSER_TTS");
      const result = await mutateSpeech({ text: spokenText, language, gender: voiceGenderRef.current });
      const audioContents = Array.isArray(result.allChunks) && result.allChunks.length ? result.allChunks : [result.audioContent];
      await playAudioQueue(audioContents, result.mimeType, session);
      if (session === sessionRef.current) setIsSpeaking(false);
    } catch (error) {
      if (session !== sessionRef.current) return;
      console.warn("[ALASSAUL speech] Google TTS unavailable; using queued browser voice", error);
      browserCancelRef.current = speakChunked(spokenText, language, voiceGenderRef.current, () => setIsSpeaking(true), () => setIsSpeaking(false)) ?? null;
    }
  }, [language, playAudioQueue, stopSpeaking, text]);

  useEffect(() => {
    if (!autoSpeak || !text.trim()) return;
    void speak();
    return stopSpeaking;
  }, [autoSpeak, speak, stopSpeaking, text]);

  return <button className={`speak-button ${isSpeaking ? "is-speaking" : ""}`} onClick={isSpeaking ? stopSpeaking : () => void speak()} aria-label={isSpeaking ? "إيقاف الرد الصوتي" : "تشغيل الرد صوتياً"} data-speech-state={isSpeaking ? "speaking" : "idle"} type="button">
    {isSpeaking ? <Pause size={13} /> : <Volume2 size={13} />}
    <small>{isSpeaking ? "إيقاف" : "استماع"}</small>
  </button>;
}

export type { VoiceGender };
