import "server-only";

import {
  consumerBookingCanCancel,
  consumerBookingFromRow,
  type ConsumerBookingRow,
} from "@/lib/bookings/status";
import { createConsumerBookingCancellationToken } from "@/lib/bookings/cancellation-token";
import { createRescheduleToken } from "@/lib/bookings/reschedule-token";
import {
  getRequestHistorySecret,
  readRequestHistoryIds,
} from "@/lib/history/session";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { ConsumerBookingsData } from "@/types/booking";

export class BookingStatusSecretMissingError extends Error {
  constructor() {
    super("Booking status ownership encryption is not configured");
    this.name = "BookingStatusSecretMissingError";
  }
}

function unavailableBookings(): ConsumerBookingsData {
  return {
    source: isSupabaseConfigured() ? "catalog" : "demo",
    bookingsAvailable: false,
    scope: "this-browser",
    entries: [],
  };
}

export async function getConsumerBookingsData(
  historyToken: string | undefined,
): Promise<ConsumerBookingsData> {
  if (!isSupabaseAdminConfigured()) return unavailableBookings();
  if (!getRequestHistorySecret()) throw new BookingStatusSecretMissingError();
  const requestIds = readRequestHistoryIds(historyToken);
  if (requestIds.length === 0) {
    return {
      source: "live",
      bookingsAvailable: true,
      scope: "this-browser",
      entries: [],
    };
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("bookings")
    .select("id,booked_for,price,currency,status,created_at,merchant_responded_at,businesses(name,address),services(name,duration_minutes),availability(end_time)")
    .in("request_id", requestIds)
    .order("created_at", { ascending: false })
    .limit(requestIds.length);
  if (result.error) throw new Error(result.error.message);

  const nowMs = Date.now();

  return {
    source: "live",
    bookingsAvailable: true,
    scope: "this-browser",
    entries: ((result.data ?? []) as unknown as ConsumerBookingRow[]).map(
      (row) => consumerBookingFromRow(
        row,
        consumerBookingCanCancel(row.status, row.booked_for, nowMs)
          ? createConsumerBookingCancellationToken(row.id)
          : null,
        consumerBookingCanCancel(row.status, row.booked_for, nowMs)
          ? createRescheduleToken({ kind: "start", bookingId: row.id, bookedFor: row.booked_for })
          : null,
      ),
    ),
  };
}
