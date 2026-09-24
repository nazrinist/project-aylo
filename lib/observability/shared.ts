import { z } from "zod";
import type { AgentRunRecord } from "@/types/observability";

const AgentRunRecordSchema = z
  .object({
    traceId: z.string().uuid(),
    requestId: z.string().uuid().nullable(),
    operation: z.enum(["intent_extraction", "provider_search"]),
    source: z.enum(["openai", "demo", "supabase"]),
    model: z.string().trim().min(1).max(100).nullable(),
    status: z.enum(["succeeded", "failed"]),
    latencyMs: z.number().int().min(0).max(86_400_000),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/).nullable(),
  })
  .strict();

export function normalizeLatency(startedAtMs: number, finishedAtMs = performance.now()) {
  return Math.max(0, Math.round(finishedAtMs - startedAtMs));
}

export function agentRunInsert(raw: AgentRunRecord) {
  const run = AgentRunRecordSchema.parse(raw);
  return {
    trace_id: run.traceId,
    request_id: run.requestId,
    operation: run.operation,
    source: run.source,
    model: run.model,
    status: run.status,
    latency_ms: run.latencyMs,
    input_tokens: run.inputTokens,
    output_tokens: run.outputTokens,
    error_code: run.errorCode,
    cost_usd: null,
  };
}

export function observabilityHeaders(traceId: string, latencyMs: number) {
  return {
    "Cache-Control": "private, no-store",
    "Server-Timing": `aylo;dur=${latencyMs}`,
    "X-Aylo-Trace-Id": traceId,
  };
}
