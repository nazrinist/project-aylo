import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  cancelConsumerBooking,
  BookingCancellationForbiddenError,
  BookingCancellationNotConfiguredError,
  BookingCancellationUnavailableError,
} from "@/lib/bookings/cancellation";
import { BookingCancellationWriteError } from "@/lib/bookings/cancellation-errors";
import { requireBetaAccess } from "@/lib/beta/response";
import { requirePublicBetaRateLimit } from "@/lib/beta/rate-limit";
import { REQUEST_HISTORY_COOKIE } from "@/lib/history/session";
import { ConsumerBookingCancellationInputSchema } from "@/types/booking";

export const dynamic = "force-dynamic";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function POST(request: NextRequest) {
  const betaAccessError = requireBetaAccess(request);
  if (betaAccessError) return betaAccessError;
  const betaRateLimitError = await requirePublicBetaRateLimit(request, "booking");
  if (betaRateLimitError) return betaRateLimitError;

  try {
    const input = ConsumerBookingCancellationInputSchema.parse(
      await request.json(),
    );
    const result = await cancelConsumerBooking(
      input,
      request.cookies.get(REQUEST_HISTORY_COOKIE)?.value,
    );
    return privateJson({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return privateJson({
        ok: false,
        code: "BOOKING_CANCELLATION_INPUT_INVALID",
        error: "Explicitly confirm a valid booking cancellation.",
      }, 400);
    }

    if (error instanceof BookingCancellationUnavailableError) {
      return privateJson({
        ok: false,
        code: "BOOKING_CANCELLATION_UNAVAILABLE",
        error: "Live cancellation requires the server-side Supabase secret key.",
      }, 503);
    }

    if (error instanceof BookingCancellationNotConfiguredError) {
      return privateJson({
        ok: false,
        code: "BOOKING_CANCELLATION_NOT_CONFIGURED",
        error: "Booking cancellation is not configured.",
      }, 503);
    }

    if (error instanceof BookingCancellationForbiddenError) {
      return privateJson({
        ok: false,
        code: "BOOKING_CANCELLATION_FORBIDDEN",
        error: "This cancellation action expired or changed. Refresh My bookings.",
      }, 403);
    }

    if (error instanceof BookingCancellationWriteError) {
      return privateJson({
        ok: false,
        code: error.details.code,
        error: error.details.message,
      }, error.details.status);
    }

    console.error("Consumer booking cancellation failed");
    return privateJson({
      ok: false,
      code: "BOOKING_CANCELLATION_FAILED",
      error: "The booking could not be cancelled. Try again.",
    }, 500);
  }
}
