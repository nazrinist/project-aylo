import { type NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  let savedRequestId: string | null = null;

  try {
    const intent = IntentSchema.parse(await request.json());
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
    const response = NextResponse.json({
      ok: true,
      requestPersistence,
      ...search,
      results,
    }, {
      headers: { "Cache-Control": "private, no-store" },
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
