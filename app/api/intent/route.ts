import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { extractIntentWithTelemetry } from "@/lib/ai/intent";
import { nextFollowUpQuestion } from "@/lib/intent/follow-up";
import { recordAgentRun } from "@/lib/observability/agent-runs";
import {
  normalizeLatency,
  observabilityHeaders,
} from "@/lib/observability/shared";
import { applySearchPreferences } from "@/lib/preferences/shared";
import {
  assertSafeRequest,
  RequestSafetyError,
} from "@/lib/safety/request-policy";
import {
  PREFERENCES_COOKIE,
  readPreferences,
} from "@/lib/preferences/session";

const BodySchema = z.object({ request: z.string().trim().min(3).max(1000) });

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  const startedAt = performance.now();
  try {
    const body = BodySchema.parse(await req.json());
    assertSafeRequest(body.request);
    const extraction = await extractIntentWithTelemetry(body.request);
    const { intent, appliedPreferences } = applySearchPreferences(
      extraction.intent,
      readPreferences(req.cookies.get(PREFERENCES_COOKIE)?.value),
    );
    const latencyMs = normalizeLatency(startedAt);
    await recordAgentRun({
      traceId,
      requestId: null,
      operation: "intent_extraction",
      source: extraction.source,
      model: extraction.model,
      status: "succeeded",
      latencyMs,
      inputTokens: extraction.inputTokens,
      outputTokens: extraction.outputTokens,
      errorCode: null,
    });
    return NextResponse.json({
      ok: true,
      intent,
      followUp: nextFollowUpQuestion(intent),
      appliedPreferences,
    }, {
      headers: observabilityHeaders(traceId, latencyMs),
    });
  } catch (error) {
    const latencyMs = normalizeLatency(startedAt);
    await recordAgentRun({
      traceId,
      requestId: null,
      operation: "intent_extraction",
      source: process.env.OPENAI_API_KEY ? "openai" : "demo",
      model: process.env.OPENAI_API_KEY ? "gpt-5.6-mini" : null,
      status: "failed",
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorCode: error instanceof z.ZodError
        ? "VALIDATION_ERROR"
        : error instanceof RequestSafetyError
          ? error.code
          : "INTENT_EXTRACTION_ERROR",
    });
    const safetyError = error instanceof RequestSafetyError ? error : null;
    return NextResponse.json({
      ok: false,
      code: safetyError?.code ?? "INTENT_REQUEST_INVALID",
      error: safetyError?.message ?? "The request could not be understood. Check the details and try again.",
    }, {
      status: safetyError ? 422 : 400,
      headers: observabilityHeaders(traceId, latencyMs),
    });
  }
}
