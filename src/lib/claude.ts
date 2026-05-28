import { query } from "@anthropic-ai/claude-agent-sdk";

export const MODELS = {
  generation: "claude-sonnet-4-6",
  classification: "claude-haiku-4-5-20251001",
} as const;

function buildSubprocessEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (k === "ANTHROPIC_API_KEY" && v.trim() === "") continue;
    env[k] = v;
  }
  env.CLAUDE_AGENT_SDK_CLIENT_APP = "twitter-machine/0.1.0";
  return env;
}

/**
 * Single-turn LLM call routed through Claude Code's auth (subscription or API key).
 * No tools, no agentic loop — just system prompt + user prompt → text response.
 */
export async function generateText(args: {
  system: string;
  user: string;
  model?: string;
  maxTurns?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const abortController = new AbortController();
  if (args.signal) {
    args.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
    });
  }

  const result = query({
    prompt: args.user,
    options: {
      systemPrompt: args.system,
      model: args.model ?? MODELS.generation,
      tools: [],
      permissionMode: "bypassPermissions",
      maxTurns: args.maxTurns ?? 1,
      abortController,
      env: buildSubprocessEnv(),
      includePartialMessages: false,
    },
  });

  let resultText = "";
  let errored: string | null = null;

  for await (const msg of result) {
    if (msg.type === "result") {
      if (msg.subtype === "success") {
        resultText = msg.result;
      } else {
        errored = msg.errors?.join("; ") || msg.subtype;
      }
      break;
    }
    if (msg.type === "assistant" && msg.error) {
      errored = msg.error;
      break;
    }
  }

  if (errored) {
    throw new Error(`Claude Agent SDK error: ${errored}`);
  }
  if (!resultText) {
    throw new Error("Claude Agent SDK returned no text");
  }
  return resultText;
}
