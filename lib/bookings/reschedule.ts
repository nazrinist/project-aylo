import "server-only";

import { createRescheduleToken, verifyRescheduleToken } from "@/lib/bookings/reschedule-token";
import type { RescheduleClaims } from "@/lib/bookings/reschedule-token-core";
import { getRequestHistorySecret, readRequestHistoryIds } from "@/lib/history/session";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import type { ConsumerRescheduleOption } from "@/types/booking";

export class RescheduleError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function ownership<K extends RescheduleClaims["kind"]>(historyToken: string | undefined, token: string, kind: K): {
  ids: string[]; claims: Extract<RescheduleClaims, { kind: K }>;
} {
  if (!isSupabaseAdminConfigured() || !getRequestHistorySecret())
    throw new RescheduleError("RESCHEDULE_UNAVAILABLE", "Live rescheduling is not configured.", 503);
  const ids = readRequestHistoryIds(historyToken);
  const claims = verifyRescheduleToken(token);
  if (!ids.length || !claims || claims.kind !== kind)
    throw new RescheduleError("RESCHEDULE_FORBIDDEN", "This action expired or changed. Refresh My bookings.", 403);
  return { ids, claims: claims as Extract<RescheduleClaims, { kind: K }> };
}

export async function getRescheduleOptions(actionToken: string, historyToken: string | undefined) {
  const { ids, claims } = ownership(historyToken, actionToken, "start");
  const supabase = getSupabaseAdminClient();
  const bookingResult = await supabase.from("bookings")
    .select("id,service_id,business_id,booked_for,status,availability_id,consumer_rescheduled_at")
    .eq("id", claims.bookingId).in("request_id", ids).maybeSingle();
  if (bookingResult.error) {
    if (bookingResult.error.code === "42703" || bookingResult.error.message.includes("consumer_rescheduled_at"))
      throw new RescheduleError("RESCHEDULE_MIGRATION_REQUIRED", "Run the Day 33 Supabase migration and restart the server.", 503);
    throw new RescheduleError("RESCHEDULE_FAILED", "Could not load available times.", 500);
  }
  const booking = bookingResult.data;
  if (!booking) throw new RescheduleError("RESCHEDULE_FORBIDDEN", "This action expired or changed. Refresh My bookings.", 403);
  if (booking.booked_for !== claims.bookedFor ||
    !["pending_confirmation", "accepted"].includes(booking.status) ||
    Date.parse(booking.booked_for) <= Date.now() || !booking.availability_id || !booking.service_id)
    throw new RescheduleError("BOOKING_CHANGED", "This booking changed. Refresh My bookings.", 409);

  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const slots = await supabase.from("availability")
    .select("id,start_time")
    .eq("business_id", booking.business_id)
    .eq("service_id", booking.service_id)
    .eq("status", "available")
    .gt("start_time", now.toISOString())
    .lte("start_time", end.toISOString())
    .order("start_time", { ascending: true })
    .limit(12);
  if (slots.error) throw new RescheduleError("RESCHEDULE_FAILED", "Could not load available times.", 500);

  const options: ConsumerRescheduleOption[] = (slots.data ?? []).map((slot) => ({
    bookedFor: slot.start_time,
    optionToken: createRescheduleToken({
      kind: "option", bookingId: booking.id, bookedFor: booking.booked_for,
      lastRescheduledAt: booking.consumer_rescheduled_at, slotId: slot.id,
    }),
  }));
  return { options };
}

export async function rescheduleConsumerBooking(optionToken: string, historyToken: string | undefined) {
  const { ids, claims } = ownership(historyToken, optionToken, "option");
  const supabase = getSupabaseAdminClient();
  const result = await supabase.rpc("reschedule_consumer_booking", {
    p_booking_id: claims.bookingId,
    p_authorized_request_ids: ids,
    p_expected_booked_for: claims.bookedFor,
    p_expected_rescheduled_at: claims.lastRescheduledAt,
    p_new_slot_id: claims.slotId,
    p_user_confirmed: true,
  });
  if (result.error) {
    const message = result.error.message;
    if (message.includes("BOOKING_NOT_FOUND"))
      throw new RescheduleError("RESCHEDULE_FORBIDDEN", "This action expired or changed. Refresh My bookings.", 403);
    if (message.includes("BOOKING_CHANGED") || message.includes("BOOKING_NOT_RESCHEDULABLE"))
      throw new RescheduleError("BOOKING_CHANGED", "This booking changed. Refresh My bookings.", 409);
    if (message.includes("SLOT_UNAVAILABLE"))
      throw new RescheduleError("SLOT_UNAVAILABLE", "That time is no longer available. Choose another.", 409);
    if (result.error.code === "PGRST202" || message.includes("reschedule_consumer_booking"))
      throw new RescheduleError("RESCHEDULE_MIGRATION_REQUIRED", "Run the Day 33 Supabase migration and restart the server.", 503);
    throw new RescheduleError("RESCHEDULE_FAILED", "The booking could not be rescheduled.", 500);
  }
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row || row.new_status !== "pending_confirmation" ||
    !Number.isFinite(Date.parse(row.new_booked_for)))
    throw new RescheduleError("RESCHEDULE_FAILED", "The booking could not be rescheduled.", 500);
  return { reference: claims.bookingId.slice(0, 8).toUpperCase(),
    bookedFor: row.new_booked_for as string, status: "pending_confirmation" as const };
}
