import { ENV } from "./env";

export type TtsLanguage = "AR" | "TR" | "EN";

const languageConfig: Record<TtsLanguage, { languageCode: string; male: string; female: string }> = {
  AR: { languageCode: "ar-XA", male: "ar-XA-Wavenet-B", female: "ar-XA-Wavenet-A" },
  TR: { languageCode: "tr-TR", male: "tr-TR-Wavenet-B", female: "tr-TR-Wavenet-A" },
  EN: { languageCode: "en-US", male: "en-US-Wavenet-D", female: "en-US-Wavenet-F" },
};

function splitText(text: string, maxLen = 4000): string[] {
  const sentences = text.split(/(?<=[.!؟?。۔])/g);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

export async function synthesizeSpeech(text: string, language: TtsLanguage, gender: "male" | "female") {
  if (!ENV.googleTtsApiKey) {
    throw new Error("NO_GOOGLE_KEY_USE_BROWSER_TTS");
  }
  const config = languageConfig[language];
  const chunks = splitText(text, 4000);
  const audios: string[] = [];

  for (const chunk of chunks) {
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
