import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingCreateInputSchema } from "@/types/booking";
import { BookingWriteError } from "@/lib/bookings/errors";
import {
  getBookingSigningSecret,
  verifyBookingOfferToken,
} from "@/lib/bookings/offer-token";
import { persistConfirmedBooking } from "@/lib/bookings/persistence";
import { bookingClaimsFromInput } from "@/lib/bookings/shared";
import { isSupabaseAdminConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function persistenceUnavailable() {
  return NextResponse.json(
    {
      ok: false,
      code: "BOOKING_PERSISTENCE_DISABLED",
      error: "Booking persistence requires the server-side Supabase secret key",
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
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
      return NextResponse.json(
        {
          ok: false,
          code: "OFFER_TOKEN_INVALID",
          error: "This booking offer is invalid or was changed. Run the search again",
        },
        { status: 403 },
      );
    }

    const result = await persistConfirmedBooking(input);
    return NextResponse.json(
      { ok: true, ...result },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "BOOKING_INPUT_INVALID",
          error: "The booking confirmation payload is invalid",
        },
        { status: 400 },
      );
    }

    if (error instanceof BookingWriteError) {
      return NextResponse.json(
        {
          ok: false,
          code: error.details.code,
          error: error.details.message,
        },
        { status: error.details.status },
      );
    }

    console.error(
      "Booking persistence failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      {
        ok: false,
        code: "BOOKING_FAILED",
        error: "The booking could not be created. Please try again",
      },
      { status: 500 },
    );
  }
}
