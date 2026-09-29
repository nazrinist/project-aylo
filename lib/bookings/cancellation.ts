import "server-only";

import {
  bookingCancellationErrorDetails,
  BookingCancellationWriteError,
} from "@/lib/bookings/cancellation-errors";
import { verifyConsumerBookingCancellationToken } from "@/lib/bookings/cancellation-token";
import {
  getRequestHistorySecret,
  readRequestHistoryIds,
} from "@/lib/history/session";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";
import type {
  ConsumerBookingCancellationInput,
  ConsumerBookingCancellationResult,
} from "@/types/booking";

type BookingCancellationRpcRow = {
  cancellation_status: string;
  cancellation_recorded_at: string;
  was_updated: boolean;
};

export class BookingCancellationUnavailableError extends Error {
  constructor() {
    super("Live booking cancellation is unavailable");
    this.name = "BookingCancellationUnavailableError";
  }
}

export class BookingCancellationNotConfiguredError extends Error {
  constructor() {
    super("Booking cancellation ownership is not configured");
    this.name = "BookingCancellationNotConfiguredError";
  }
}

export class BookingCancellationForbiddenError extends Error {
  constructor() {
    super("Booking cancellation token or browser ownership is invalid");
    this.name = "BookingCancellationForbiddenError";
  }
}

export async function cancelConsumerBooking(
  input: ConsumerBookingCancellationInput,
  historyToken: string | undefined,
): Promise<ConsumerBookingCancellationResult> {
  if (!isSupabaseAdminConfigured()) {
    throw new BookingCancellationUnavailableError();
  }
  if (!getRequestHistorySecret()) {
    throw new BookingCancellationNotConfiguredError();
  }

  const requestIds = readRequestHistoryIds(historyToken);
  if (requestIds.length === 0) throw new BookingCancellationForbiddenError();
  const claims = verifyConsumerBookingCancellationToken(input.actionToken);
  if (!claims) throw new BookingCancellationForbiddenError();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("cancel_consumer_booking", {
    p_booking_id: claims.bookingId,
    p_authorized_request_ids: requestIds,
    p_user_confirmed: input.confirmed,
  });
  if (error) {
    throw new BookingCancellationWriteError(
      bookingCancellationErrorDetails(error.message, error.code),
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | BookingCancellationRpcRow
    | null;
  if (
    !row ||
    row.cancellation_status !== "cancelled" ||
    !row.cancellation_recorded_at ||
    typeof row.was_updated !== "boolean"
  ) {
    throw new BookingCancellationWriteError(
      bookingCancellationErrorDetails("Cancellation RPC returned no valid row"),
    );
  }

  return {
    reference: claims.bookingId.slice(0, 8).toUpperCase(),
    status: "cancelled",
    changed: row.was_updated,
  };
}
