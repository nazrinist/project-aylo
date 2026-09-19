import { NextResponse } from "next/server";
import { IntentSchema } from "@/types/intent";
import type { BookableSearchResult } from "@/types/search";
import {
  getBookingSigningSecret,
  signBookingOffer,
} from "@/lib/bookings/offer-token";
import { bookingClaimsFromResult } from "@/lib/bookings/shared";
import { searchProviders } from "@/lib/search/providers";
import {
  createSearchRequest,
  finishSearchRequest,
} from "@/lib/requests/persistence";

export async function POST(request: Request) {
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
    return NextResponse.json({
      ok: true,
      requestPersistence,
      ...search,
      results,
    });
  } catch (error) {
    if (savedRequestId) await finishSearchRequest(savedRequestId, "failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
