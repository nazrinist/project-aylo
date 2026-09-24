import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { IntentSchema } from "@/types/intent";
import type { BookableSearchResult } from "@/types/search";
import {
  getBookingSigningSecret,
  signBookingOffer,
} from "@/lib/bookings/offer-token";
import { bookingClaimsFromResult } from "@/lib/bookings/shared";
import {
  REQUEST_HISTORY_COOKIE,
  requestHistoryCookieOptions,
  rollRequestHistoryToken,
} from "@/lib/history/session";
import { searchProviders } from "@/lib/search/providers";
import {
  createSearchRequest,
  finishSearchRequest,
} from "@/lib/requests/persistence";
import { recordAgentRun } from "@/lib/observability/agent-runs";
import {
  normalizeLatency,
  observabilityHeaders,
} from "@/lib/observability/shared";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  assertSafeRequest,
  RequestSafetyError,
} from "@/lib/safety/request-policy";

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const startedAt = performance.now();
  let savedRequestId: string | null = null;

  try {
    const intent = IntentSchema.parse(await request.json());
    assertSafeRequest(intent.original_request);
    let requestPersistence = await createSearchRequest(intent);
    savedRequestId = requestPersistence.requestId;
    const search = await searchProviders(intent);
    let bookingRequestId: string | null = null;
    if (savedRequestId) {
      const requestReady = await finishSearchRequest(
        savedRequestId,
        "searched",
        search.results.length,
      );
      if (requestReady) {
        bookingRequestId = savedRequestId;
      } else {
        requestPersistence = { status: "failed", requestId: null };
      }
    }
    const signingSecret = getBookingSigningSecret();
    const results: BookableSearchResult[] = search.results.map((result) => ({
      ...result,
      bookingToken:
        bookingRequestId && search.source === "supabase" && signingSecret
          ? signBookingOffer(
              bookingClaimsFromResult(bookingRequestId, result),
              signingSecret,
            )
          : null,
    }));
    const latencyMs = normalizeLatency(startedAt);
    await recordAgentRun({
      traceId,
      requestId: savedRequestId,
      operation: "provider_search",
      source: search.source,
      model: null,
      status: "succeeded",
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorCode: null,
    });
    const response = NextResponse.json({
      ok: true,
      requestPersistence,
      ...search,
      results,
    }, {
      headers: observabilityHeaders(traceId, latencyMs),
    });
    if (bookingRequestId) {
      const historyToken = rollRequestHistoryToken(
        request.cookies.get(REQUEST_HISTORY_COOKIE)?.value,
        bookingRequestId,
      );
      if (historyToken) {
        response.cookies.set({
          name: REQUEST_HISTORY_COOKIE,
          value: historyToken,
          ...requestHistoryCookieOptions(),
        });
      }
    }
    return response;
  } catch (error) {
    if (savedRequestId) await finishSearchRequest(savedRequestId, "failed");
    const latencyMs = normalizeLatency(startedAt);
    await recordAgentRun({
      traceId,
      requestId: savedRequestId,
      operation: "provider_search",
      source: isSupabaseConfigured() ? "supabase" : "demo",
      model: null,
      status: "failed",
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorCode: error instanceof RequestSafetyError
        ? error.code
        : "PROVIDER_SEARCH_ERROR",
    });
    const safetyError = error instanceof RequestSafetyError ? error : null;
    return NextResponse.json({
      ok: false,
      code: safetyError?.code ?? "SEARCH_REQUEST_INVALID",
      error: safetyError?.message ?? "Search could not be completed. Check the request and try again.",
    }, {
      status: safetyError ? 422 : 400,
      headers: observabilityHeaders(traceId, latencyMs),
    });
  }
}
