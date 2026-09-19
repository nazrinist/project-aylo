import "server-only";

import type {
  BookingCreateInput,
  BookingSaveResult,
  BookingStatus,
} from "@/types/booking";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { bookingErrorDetails, BookingWriteError } from "./errors";

type BookingRpcRow = {
  booking_id: string;
  booking_request_id: string;
  booking_availability_id: string;
  booking_business_id: string;
  booking_service_id: string;
  booking_booked_for: string;
  booking_price: number | string;
  booking_currency: string;
  booking_status: BookingStatus;
  booking_user_confirmed_at: string;
  booking_created_at: string;
  was_created: boolean;
};

export async function persistConfirmedBooking(
  input: BookingCreateInput,
): Promise<BookingSaveResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "create_booking_from_confirmation",
    {
      p_request_id: input.requestId,
      p_availability_id: input.availabilityId,
      p_expected_business_id: input.businessId,
      p_expected_service_id: input.serviceId,
      p_expected_booked_for: input.bookedFor,
      p_expected_price: input.expectedPrice,
      p_expected_currency: input.expectedCurrency,
      p_user_confirmed: input.userConfirmed,
    },
  );

  if (error) {
    throw new BookingWriteError(bookingErrorDetails(error.message, error.code));
  }

  const row = (Array.isArray(data) ? data[0] : data) as BookingRpcRow | null;
  if (!row) {
    throw new BookingWriteError(
      bookingErrorDetails("Booking RPC returned no row"),
    );
  }

  return {
    booking: {
      id: row.booking_id,
      requestId: row.booking_request_id,
      availabilityId: row.booking_availability_id,
      businessId: row.booking_business_id,
      serviceId: row.booking_service_id,
      bookedFor: row.booking_booked_for,
      price: Number(row.booking_price),
      currency: row.booking_currency,
      status: row.booking_status,
      userConfirmedAt: row.booking_user_confirmed_at,
      createdAt: row.booking_created_at,
    },
    created: row.was_created,
  };
}
