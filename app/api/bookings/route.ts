import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingCreateInputSchema } from "@/types/booking";
import { BookingWriteError } from "@/lib/bookings/errors";
import {
  BookingStatusSecretMissingError,
  getConsumerBookingsData,
} from "@/lib/bookings/status-data";
import {
  getBookingSigningSecret,
  verifyBookingOfferToken,
} from "@/lib/bookings/offer-token";
import { persistConfirmedBooking } from "@/lib/bookings/persistence";
import { bookingClaimsFromInput } from "@/lib/bookings/shared";
import { isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { requireBetaAccess } from "@/lib/beta/response";
import { requirePublicBetaRateLimit } from "@/lib/beta/rate-limit";
import { REQUEST_HISTORY_COOKIE } from "@/lib/history/session";

export const dynamic = "force-dynamic";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

function persistenceUnavailable() {
  return privateJson(
    {
      ok: false,
      code: "BOOKING_PERSISTENCE_DISABLED",
      error: "Booking persistence requires the server-side Supabase secret key",
    },
    503,
  );
}

export async function GET(request: NextRequest) {
  const betaAccessError = requireBetaAccess(request);
  if (betaAccessError) return betaAccessError;
  if (request.nextUrl.searchParams.size > 0) {
    return privateJson({
      ok: false,
      code: "BOOKING_STATUS_QUERY_INVALID",
      error: "Booking status does not accept query parameters.",
    }, 400);
  }

  try {
    const data = await getConsumerBookingsData(
      request.cookies.get(REQUEST_HISTORY_COOKIE)?.value,
    );
    return privateJson({ ok: true, ...data });
  } catch (error) {
    if (error instanceof BookingStatusSecretMissingError) {
      return privateJson({
        ok: false,
        code: "BOOKING_STATUS_SECRET_MISSING",
        error: "Booking status is not configured.",
      }, 503);
    }
    console.error("Consumer booking status load failed");
    return privateJson({
      ok: false,
      code: "BOOKING_STATUS_LOAD_FAILED",
      error: "Booking status could not be loaded.",
    }, 500);
  }
}

export async function POST(request: NextRequest) {
  const betaAccessError = requireBetaAccess(request);
  if (betaAccessError) return betaAccessError;
  const betaRateLimitError = await requirePublicBetaRateLimit(request, "booking");
  if (betaRateLimitError) return betaRateLimitError;
  if (!isSupabaseAdminConfigured()) return persistenceUnavailable();
  const signingSecret = getBookingSigningSecret();
  if (!signingSecret) return persistenceUnavailable();

  try {
    const input = BookingCreateInputSchema.parse(await request.json());
    const validOffer = verifyBookingOfferToken(
      bookingClaimsFromInput(input),
      input.bookingToken,
      signingSecret,
    );

    if (!validOffer) {
      return privateJson(
        {
          ok: false,
          code: "OFFER_TOKEN_INVALID",
          error: "This booking offer is invalid or was changed. Run the search again",
        },
        403,
      );
    }

    const result = await persistConfirmedBooking(input);
    return privateJson(
      { ok: true, ...result },
      result.created ? 201 : 200,
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return privateJson(
        {
          ok: false,
          code: "BOOKING_INPUT_INVALID",
          error: "The booking confirmation payload is invalid",
        },
        400,
      );
    }

    if (error instanceof BookingWriteError) {
      return privateJson(
        {
          ok: false,
          code: error.details.code,
          error: error.details.message,
        },
        error.details.status,
      );
    }

    console.error(
      "Booking persistence failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return privateJson(
      {
        ok: false,
        code: "BOOKING_FAILED",
        error: "The booking could not be created. Please try again",
      },
      500,
    );
  }
}
