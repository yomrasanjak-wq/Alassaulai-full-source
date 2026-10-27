import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  maxCompletionTokens?: number;
  max_completion_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveOpenAiEndpoint = (path: "chat/completions" | "models") => {
  const base = (ENV.llmApiUrl || ENV.forgeApiUrl || "https://forge.manus.ai").replace(/\/+$/, "");
  if (isResponsesGateway() && path === "models") {
    if (/\/v1\/responses$/i.test(base)) return base.replace(/\/responses$/i, "/models");
    if (/\/v1$/i.test(base)) return `${base}/models`;
    return `${base}/v1/models`;
  }
  return `${base}${base.endsWith("/v1") ? "" : "/v1"}/${path}`;
};

const resolveApiUrl = () => resolveOpenAiEndpoint("chat/completions");

/** Netlify's AI gateway exposes the Responses API, not the legacy chat-completions route. */
const isResponsesGateway = () => {
  const base = ENV.llmApiUrl || ENV.forgeApiUrl || "";
  return /\/\.netlify\/ai(?:\/|$)/i.test(base) || /\/v1\/responses$/i.test(base);
};
const resolveResponsesEndpoint = () => {
  const base = (ENV.llmApiUrl || ENV.forgeApiUrl || "").replace(/\/+$/, "");
  if (/\/v1\/responses$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/responses`;
  if (/\/\.netlify\/ai$/i.test(base)) return `${base}/v1/responses`;
  return `${base}/v1/responses`;
};

const assertApiKey = () => {
  if (!(ENV.llmApiKey || ENV.forgeApiKey)) {
    throw new Error("No language-model API key is configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;
const RETRY_MAX_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_BUDGET_MS = 18_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

const isRetryableStatus = (status: number) => status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;

// Retry transient upstream failures only. Retrying 400/401/403/404 repeatedly
// makes an invalid model, route, or credential look like a frozen chat.
const fetchWithBackoff = async (
  url: string,
  init: FetchInit
): Promise<Response> => {
  let lastError: unknown;
  const deadline = Date.now() + REQUEST_BUDGET_MS;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw lastError instanceof Error
        ? lastError
        : new Error("LLM request exceeded its overall time budget");
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Math.min(REQUEST_TIMEOUT_MS, remaining)
      );
      let response: Response;
      try {
        // Preserve caller cancellation while enforcing both per-attempt and overall deadlines.
        const signal = init.signal
          ? AbortSignal.any([init.signal, controller.signal])
          : controller.signal;
        response = await fetch(url, { ...init, signal });
      } finally {
        clearTimeout(timeout);
      }
      if (response.ok || !isRetryableStatus(response.status) || attempt === RETRY_MAX_RETRIES) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(`LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`);
      const delay = Math.min(
        computeBackoffDelay(attempt, retryAfterMs),
        Math.max(0, deadline - Date.now())
      );
      if (delay <= 0) break;
      await sleep(delay);
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES || Date.now() >= deadline) throw error;
      console.warn(`LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`);
      const delay = Math.min(
        computeBackoffDelay(attempt),
        Math.max(0, deadline - Date.now())
      );
      if (delay <= 0) throw error;
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
    maxCompletionTokens,
    max_completion_tokens,
  } = params;

  const useResponsesApi = isResponsesGateway();
  const payload: Record<string, unknown> = useResponsesApi
    ? {
        input: messages.map((message) => {
          const rawContent = message.content;
          const contentParts: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }> = [];
          if (typeof rawContent === "string") {
            contentParts.push({ type: "input_text", text: rawContent });
          } else {
            for (const part of ensureArray(rawContent)) {
              if (typeof part === "string") contentParts.push({ type: "input_text", text: part });
              else if (part.type === "text") contentParts.push({ type: "input_text", text: part.text });
              else if (part.type === "image_url") contentParts.push({ type: "input_image", image_url: part.image_url.url, detail: part.image_url.detail ?? "auto" });
              else contentParts.push({ type: "input_text", text: JSON.stringify(part) });
            }
          }
          const role = message.role === "function" || message.role === "tool" ? "assistant" : message.role;
          return { role, content: contentParts };
        }),
      }
    : { messages: messages.map(normalizeMessage) };

  const resolvedModel = model || ENV.primaryModel;
  if (resolvedModel) payload.model = resolvedModel;

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = useResponsesApi && typeof normalizedToolChoice === "object"
      ? normalizedToolChoice.function.name
      : normalizedToolChoice;
  }
  if (useResponsesApi && tools?.length) {
    payload.tools = tools.map((tool) => ({
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters ?? {},
      strict: false,
    }));
  }

  const resolvedMaxCompletionTokens = max_completion_tokens ?? maxCompletionTokens;
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (useResponsesApi) {
    const outputLimit = resolvedMaxCompletionTokens ?? resolvedMaxTokens;
    if (typeof outputLimit === "number") payload.max_output_tokens = outputLimit;
  } else if (typeof resolvedMaxCompletionTokens === "number") {
    payload.max_completion_tokens = resolvedMaxCompletionTokens;
  } else if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (thinking && !useResponsesApi) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    if (useResponsesApi) {
      if (normalizedResponseFormat.type === "json_schema") {
        payload.text = { format: { type: "json_schema", name: normalizedResponseFormat.json_schema.name, schema: normalizedResponseFormat.json_schema.schema, strict: normalizedResponseFormat.json_schema.strict ?? false } };
      } else if (normalizedResponseFormat.type === "json_object") {
        payload.text = { format: { type: "json_object" } };
      } else {
        payload.text = { format: { type: "text" } };
      }
    } else {
      payload.response_format = normalizedResponseFormat;
    }
  }

  const response = await fetchWithBackoff(useResponsesApi ? resolveResponsesEndpoint() : resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.llmApiKey || ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const result = await response.json() as Record<string, any>;
  if (!useResponsesApi) return result as unknown as InvokeResult;

  // Normalize Responses API output to the chat-completions shape consumed by this app.
  const outputItems = Array.isArray(result.output) ? result.output : [];
  const topLevelText = typeof result.output_text === "string"
    ? result.output_text.trim()
    : "";
  // Some compatible gateways include output_text but leave it empty while still
  // returning the actual answer in output[].content[]. Keep the nested extraction
  // as a fallback rather than letting an empty top-level field mask a valid reply.
  const nestedText = outputItems
    .filter((item: any) => item?.type === "message")
    .flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
    .filter((part: any) => (part?.type === "output_text" || part?.type === "text") && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
  const text = topLevelText || nestedText;
  const toolCalls = outputItems
    .filter((item: any) => item?.type === "function_call")
    .map((item: any) => ({ id: item.call_id || item.id, type: "function", function: { name: item.name, arguments: item.arguments || "{}" } }));
  return {
    id: result.id || "responses-api-result",
    created: Math.floor(Date.now() / 1000),
    model: result.model || params.model || "unknown",
    choices: [{
      index: 0,
      message: { role: "assistant", content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
      finish_reason: result.status === "incomplete" ? "length" : toolCalls.length ? "tool_calls" : "stop",
    }],
    usage: result.usage ? { prompt_tokens: result.usage.input_tokens || 0, completion_tokens: result.usage.output_tokens || 0, total_tokens: result.usage.total_tokens || 0 } : undefined,
  } as InvokeResult;
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey();

  const url = resolveOpenAiEndpoint("models");

  const response = await fetchWithBackoff(url, {
    headers: { authorization: `Bearer ${ENV.llmApiKey || ENV.forgeApiKey}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as ModelsResponse;
}
