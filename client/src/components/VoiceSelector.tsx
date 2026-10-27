import React, { useEffect, useState } from "react";
import type { VoiceGender } from "./AssistantReply";

const STORAGE_KEY = "alassault-voice-gender";
const maleVoiceHints = ["male", "man", "adam", "khalid", "khaled", "خالد", "آدم", "maged", "tarik", "naayf", "hamed", "hamad", "fahd", "omar", "yousef", "hisham", "abdul", "ذكر", "رجل"];
const femaleVoiceHints = ["female", "woman", "girl", "saba", "laila", "zira", "hoda", "heba", "layla", "فاطمة", "ليلى", "هدى", "أنثى", "امرأة"];

function isDistinctArabicMaleVoice(name: string) {
  const normalized = name.toLowerCase();
  if (femaleVoiceHints.some((hint) => normalized.includes(hint))) return false;
  return maleVoiceHints.some((hint) => normalized.includes(hint));
}

function isDistinctArabicFemaleVoice(name: string) {
  const normalized = name.toLowerCase();
  if (maleVoiceHints.some((hint) => normalized.includes(hint))) return false;
  return femaleVoiceHints.some((hint) => normalized.includes(hint));
}

type VoiceSelectorProps = {
  value?: VoiceGender;
  onChange?: (value: VoiceGender) => void;
};

export function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const [storedValue, setStoredValue] = useState<VoiceGender>(() => {
    if (typeof window === "undefined") return "male";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "female" ? "female" : "male";
  });
  const [voiceAvailability, setVoiceAvailability] = useState<{ male: boolean; female: boolean } | null>(null);
  const selected = value ?? storedValue;

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceAvailability({ male: false, female: false });
      return;
    }
    const synthesis = window.speechSynthesis;
    const detect = () => {
      const voices = typeof synthesis.getVoices === "function" ? synthesis.getVoices() : [];
      const arabicVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ar"));
      setVoiceAvailability({
        male: arabicVoices.some((voice) => isDistinctArabicMaleVoice(voice.name)),
        female: arabicVoices.some((voice) => isDistinctArabicFemaleVoice(voice.name)),
      });
    };
    detect();
    synthesis.addEventListener("voiceschanged", detect);
    return () => synthesis.removeEventListener("voiceschanged", detect);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, selected);
  }, [selected]);

  const handleChange = (next: VoiceGender) => {
    setStoredValue(next);
    onChange?.(next);
  };

  const message = !voiceAvailability
    ? "جارٍ تجهيز الصوت الواضح…"
    : !voiceAvailability.male && !voiceAvailability.female
      ? "لا يوفر جهازك صوت رجل عربي مستقلاً أو صوت امرأة عربية مستقلاً؛ سيُستخدم أفضل صوت عربي متاح مع تمييز النبرة للرجل والمرأة."
      : selected === "male" && !voiceAvailability.male
        ? "لا يوفر جهازك اسم صوت رجل عربي مستقلاً؛ سيُستخدم أفضل صوت عربي واضح."
        : selected === "female" && !voiceAvailability.female
          ? "لا يوفر جهازك اسم صوت امرأة عربية مستقلاً؛ سيُستخدم أفضل صوت عربي واضح."
          : "صوتان واضحان: رجل وامرأة، مع حفظ اختيارك على جهازك.";

  return (
    <label className="voice-choice" htmlFor="assistant-voice">
      <span>صوت الرد</span>
      <select id="assistant-voice" aria-label="اختيار صوت الرد" value={selected} onChange={(event) => handleChange(event.target.value as VoiceGender)}>
        <option value="female">امرأة — صوت واضح</option>
        <option value="male">رجل — صوت واضح</option>
      </select>
      <small aria-live="polite">{message}</small>
    </label>
  );
}
