export type AgentRunOperation = "intent_extraction" | "provider_search";
export type AgentRunSource = "openai" | "demo" | "supabase";
export type AgentRunStatus = "succeeded" | "failed";

export type AgentRunRecord = {
  traceId: string;
  requestId: string | null;
  operation: AgentRunOperation;
  source: AgentRunSource;
  model: string | null;
  status: AgentRunStatus;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
};
