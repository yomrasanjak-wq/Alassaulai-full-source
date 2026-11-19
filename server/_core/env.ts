const firstConfigured = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
};

const explicitProviderKey = firstConfigured(
  "GROQ_API_KEY",
  "VITE_GROQ_API_KEY"
);
const openAiKey = firstConfigured("OPENAI_API_KEY", "AI_API_KEY");
const openRouterKey = firstConfigured("OPENROUTER_API_KEY");
const geminiKey = firstConfigured("GEMINI_API_KEY");
const configuredBaseUrl = firstConfigured("GROQ_API_URL");

// Keep platform storage/maps credentials separate from the language model.
// An explicit ALASSAUL provider override always wins. Otherwise a dedicated
// OpenAI key selects the Responses API before Gemini or legacy providers.
const explicitLlmBaseUrl = firstConfigured("ALASSAUL_LLM_API_URL", "OPENAI_BASE_URL");
const resolvedLlmBaseUrl = explicitLlmBaseUrl ||
  (openAiKey
    ? "https://api.openai.com/v1/responses"
    : geminiKey
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : configuredBaseUrl ||
        (openRouterKey
          ? "https://openrouter.ai/api/v1"
          : "https://api.groq.com/openai/v1"));
const usesNetlifyAiGateway = /\/\.netlify\/ai(?:\/|$)/i.test(resolvedLlmBaseUrl);
const usesDirectOpenAi = /api\.openai\.com/i.test(resolvedLlmBaseUrl) && !usesNetlifyAiGateway;
const usesOpenRouter = /openrouter\.ai\/api\/v1/i.test(resolvedLlmBaseUrl);
const usesGemini = /generativelanguage\.googleapis\.com\/v1beta\/openai/i.test(resolvedLlmBaseUrl);
const resolvedLlmApiKey = firstConfigured("ALASSAUL_LLM_API_KEY") ||
  (usesGemini
    ? geminiKey
    : usesOpenRouter
      ? openRouterKey
      : usesNetlifyAiGateway
        ? openAiKey || explicitProviderKey
        : usesDirectOpenAi
          ? openAiKey
          : explicitProviderKey || openAiKey);

export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerEmail: (firstConfigured("ALASSAUL_OWNER_EMAIL", "OWNER_EMAIL") || "alassaulzon@gmail.com").toLowerCase(),
  resendApiKey: firstConfigured("RESEND_API_KEY"),
  authEmailFrom: firstConfigured("ALASSAUL_AUTH_EMAIL_FROM", "AUTH_EMAIL_FROM"),
  unifonicAuthenticateAppId: firstConfigured("UNIFONIC_AUTHENTICATE_APP_ID"),
  unifonicAuthenticateToken: firstConfigured("UNIFONIC_AUTHENTICATE_TOKEN"),
  ownerPhone: firstConfigured("ALASSAUL_OWNER_PHONE").replace(/\s/g, ""),
  isProduction: process.env.NODE_ENV === "production",
  // Temporary read-only bridge for legacy media; remove after verified Vercel Blob migration.
  storageApiUrl: firstConfigured("BUILT_IN_FORGE_API_URL"),
  storageApiKey: firstConfigured("BUILT_IN_FORGE_API_KEY"),
  llmApiUrl: resolvedLlmBaseUrl,
  llmApiKey: resolvedLlmApiKey,
  primaryModel: firstConfigured("ALASSAUL_PRIMARY_MODEL") || (usesGemini
    ? "gemini-3.8-flash"
    : usesNetlifyAiGateway
      ? "gpt-5.6-luna"
      : usesDirectOpenAi
        ? "gpt-6.1-sol"
        : usesOpenRouter
          ? "openai/gpt-4.1-mini"
          : "qwen/qwen3.8-27b"),
  backupModel: firstConfigured("ALASSAUL_BACKUP_MODEL") || (usesGemini
    ? "gemini-3.7-flash"
    : usesNetlifyAiGateway
      ? "gpt-5-mini"
      : usesDirectOpenAi
        ? "gpt-6.1-terra"
        : usesOpenRouter
          ? "openai/gpt-oss-20b"
          : "openai/gpt-oss-20b"),
  googleTtsApiKey: firstConfigured(
    "GOOGLE_TTS_API_KEY",
    "GOOGLE_CLOUD_TTS_API_KEY",
    "VITE_GOOGLE_TTS_API_KEY"
  ),
};
