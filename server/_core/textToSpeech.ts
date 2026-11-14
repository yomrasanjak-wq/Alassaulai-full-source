import { ENV } from "./env";

export type TtsLanguage = "AR" | "TR" | "EN";

const languageConfig: Record<TtsLanguage, { languageCode: string; male: string; female: string }> = {
  AR: { languageCode: "ar-XA", male: "ar-XA-Wavenet-B", female: "ar-XA-Wavenet-A" },
  TR: { languageCode: "tr-TR", male: "tr-TR-Wavenet-B", female: "tr-TR-Wavenet-A" },
  EN: { languageCode: "en-US", male: "en-US-Wavenet-D", female: "en-US-Wavenet-F" },
};

function splitText(text: string, maxLen = 3500): string[] {
  const sentences = text.split(/(?<=[.!؟?。۔])/g);
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

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function synthesizeAzureArabic(text: string, gender: "male" | "female") {
  const key = ENV.azureSpeechKey;
  const region = ENV.azureSpeechRegion;
  if (!key || !region) throw new Error("AZURE_SPEECH_NOT_CONFIGURED");

  const voice = gender === "male" ? "ar-SA-HamedNeural" : "ar-SA-ZariyahNeural";
  const audios: string[] = [];
  for (const chunk of splitText(text)) {
    const ssml = `<speak version="1.0" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="0%" pitch="0%">${escapeXml(chunk)}</prosody></voice></speak>`;
    const response = await fetch(`https://${encodeURIComponent(region)}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "ALASSAUL-AI",
      },
      body: ssml,
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Azure Speech failed: ${response.status} ${details.slice(0, 240)}`);
    }
    audios.push(Buffer.from(await response.arrayBuffer()).toString("base64"));
  }
  if (!audios.length) throw new Error("Azure Speech returned no audio");
  return { audioContent: audios[0], allChunks: audios, mimeType: "audio/mpeg" as const };
}

async function synthesizeGoogle(text: string, language: TtsLanguage, gender: "male" | "female") {
  if (!ENV.googleTtsApiKey) throw new Error("NO_TTS_PROVIDER_USE_BROWSER_TTS");
  const config = languageConfig[language];
  const audios: string[] = [];
  for (const chunk of splitText(text, 4000)) {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(ENV.googleTtsApiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text: chunk },
          voice: { languageCode: config.languageCode, name: gender === "male" ? config.male : config.female },
          audioConfig: { audioEncoding: "MP3", speakingRate: language === "AR" ? 0.96 : 1 },
        }),
      }
    );
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Google TTS failed: ${response.status} ${details.slice(0, 300)}`);
    }
    const payload = (await response.json()) as { audioContent?: string };
    if (payload.audioContent) audios.push(payload.audioContent);
  }
  if (!audios.length) throw new Error("Google TTS returned no audio");
  return { audioContent: audios[0], allChunks: audios, mimeType: "audio/mpeg" as const };
}

/** Prefer the Saudi Arabic neural voice when Azure Speech is configured.
 * Other languages retain the existing Google provider; browser speech remains
 * the client-side fallback when no provider credentials are configured. */
export async function synthesizeSpeech(text: string, language: TtsLanguage, gender: "male" | "female") {
  if (language === "AR" && ENV.azureSpeechKey && ENV.azureSpeechRegion) {
    return synthesizeAzureArabic(text, gender);
  }
  return synthesizeGoogle(text, language, gender);
}
