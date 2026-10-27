const firstConfigured = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
};

const explicitProviderKey = firstConfigured(
  "FORGE_API_KEY",
  "MANUS_API_KEY",
  "GROQ_API_KEY",
  "VITE_GROQ_API_KEY",
  "BUILT_IN_FORGE_API_KEY",
  "VITE_FRONTEND_FORGE_API_KEY",
  "VITE_FORGE_API_KEY"
);
const openAiKey = firstConfigured("OPENAI_API_KEY", "AI_API_KEY");
const configuredBaseUrl = firstConfigured(
  "FORGE_API_URL",
  "MANUS_API_URL",
  "GROQ_API_URL",
  "BUILT_IN_FORGE_API_URL",
  "VITE_FRONTEND_FORGE_API_URL"
);
// Keep the platform's original Forge/Manus URL and key intact for storage,
// maps, media, and other services. The language model gets its own endpoint.
const resolvedLlmBaseUrl = firstConfigured(
  "ALASSAUL_LLM_API_URL",
  "OPENAI_BASE_URL"
) || configuredBaseUrl || (openAiKey && !explicitProviderKey
  ? "https://api.openai.com"
  : "https://api.groq.com/openai/v1");
const usesNetlifyAiGateway = /\/\.netlify\/ai(?:\/|$)/i.test(resolvedLlmBaseUrl);
const usesDirectOpenAi = /api\.openai\.com/i.test(resolvedLlmBaseUrl) && !usesNetlifyAiGateway;
// Never send a Manus/Forge/Groq key to an explicitly configured OpenAI or
// Netlify AI endpoint just because that provider's key is also present.
// A dedicated ALASSAUL_LLM_API_KEY always wins; otherwise match the key to
// the selected endpoint before falling back to the other configured key.
const resolvedLlmApiKey = firstConfigured("ALASSAUL_LLM_API_KEY") ||
  ((usesNetlifyAiGateway || usesDirectOpenAi)
    ? openAiKey || explicitProviderKey
    : explicitProviderKey || openAiKey);

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: configuredBaseUrl || "",
  forgeApiKey: explicitProviderKey,
  llmApiUrl: resolvedLlmBaseUrl,
  llmApiKey: resolvedLlmApiKey,
  primaryModel: firstConfigured("ALASSAUL_PRIMARY_MODEL") || (usesNetlifyAiGateway
    ? "gpt-5.6-luna"
    : usesDirectOpenAi
      ? "gpt-5-mini"
      : "qwen/qwen3.8-27b"),
  backupModel: firstConfigured("ALASSAUL_BACKUP_MODEL") || (usesNetlifyAiGateway
    ? "gpt-5-mini"
    : usesDirectOpenAi
      ? "gpt-4.1-mini"
      : "openai/gpt-oss-20b"),
  googleTtsApiKey: firstConfigured(
    "GOOGLE_TTS_API_KEY",
    "GOOGLE_CLOUD_TTS_API_KEY",
    "VITE_GOOGLE_TTS_API_KEY"
  ),
};
