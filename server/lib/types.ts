/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Trimmed re-declaration of coding-agent/src/types.ts's shared LLM/tool
 * contracts (verbatim field-for-field) — the session/task/transaction types
 * from the original file are dropped since nothing here uses them.
 */

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
  extra?: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResult {
  content: string | null;
  toolCalls: ToolCallRequest[];
  usage?: TokenUsage;
}

export type LlmProvider = "kilo" | "groq" | "openrouter" | "gemini" | "cerebras" | "mistral" | "custom";

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    extra_content?: Record<string, unknown>;
  }>;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolQualityGateResult {
  name: string;
  ok: boolean;
  output: string;
}

export interface ToolExecResult {
  ok: boolean;
  output: string;
  qualityGate?: ToolQualityGateResult;
}

export type RiskLevel = "low" | "medium" | "high";

export interface ToolSpec {
  definition: ToolDefinition;
  mutating: boolean;
  describe: (args: any) => string;
  preview?: (args: any, ctx: ToolContext) => Promise<string>;
  riskOf?: (args: any) => RiskLevel;
  run: (args: any, ctx: ToolContext) => Promise<ToolExecResult>;
}

export interface ToolContext {
  root: string;
}

export interface RetryNotice {
  provider: string;
  status: number;
  attempt: number;
  maxRetries: number;
  waitMs: number;
}
