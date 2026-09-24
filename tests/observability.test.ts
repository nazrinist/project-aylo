import assert from "node:assert/strict";
import test from "node:test";
import {
  agentRunInsert,
  normalizeLatency,
  observabilityHeaders,
} from "../lib/observability/shared.ts";

const traceId = "00000000-0000-4000-8000-000000000024";

test("agent run mapping keeps only bounded operational metadata", () => {
  const insert = agentRunInsert({
    traceId,
    requestId: null,
    operation: "intent_extraction",
    source: "openai",
    model: "gpt-5.6-mini",
    status: "succeeded",
    latencyMs: 321,
    inputTokens: 140,
    outputTokens: 55,
    errorCode: null,
  });
  assert.deepEqual(insert, {
    trace_id: traceId,
    request_id: null,
    operation: "intent_extraction",
    source: "openai",
    model: "gpt-5.6-mini",
    status: "succeeded",
    latency_ms: 321,
    input_tokens: 140,
    output_tokens: 55,
    error_code: null,
    cost_usd: null,
  });
  assert.equal("prompt" in insert, false);
  assert.equal("output" in insert, false);
});

test("observability rejects arbitrary error text and invalid counters", () => {
  const base = {
    traceId,
    requestId: null,
    operation: "provider_search" as const,
    source: "demo" as const,
    model: null,
    status: "failed" as const,
    latencyMs: 1,
    inputTokens: null,
    outputTokens: null,
    errorCode: "PROVIDER_SEARCH_ERROR",
  };
  assert.throws(() => agentRunInsert({ ...base, errorCode: "Database password leaked" }));
  assert.throws(() => agentRunInsert({ ...base, latencyMs: -1 }));
});

test("trace headers expose correlation and rounded server timing", () => {
  assert.equal(normalizeLatency(100.2, 123.8), 24);
  assert.deepEqual(observabilityHeaders(traceId, 24), {
    "Cache-Control": "private, no-store",
    "Server-Timing": "aylo;dur=24",
    "X-Aylo-Trace-Id": traceId,
  });
});
