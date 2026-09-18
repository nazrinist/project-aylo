import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type SlotWindow = {
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
};

export async function validateAvailabilitySlot(
  supabase: SupabaseClient,
  slot: SlotWindow,
  excludedId?: string,
) {
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id,business_id")
    .eq("id", slot.service_id)
    .single();

  if (serviceError || !service) throw new Error("Service was not found");
  if (service.business_id !== slot.business_id) {
    throw new Error("Service does not belong to the selected business");
  }

  let overlapQuery = supabase
    .from("availability")
    .select("id")
    .eq("service_id", slot.service_id)
    .in("status", ["available", "held", "booked"])
    .lt("start_time", slot.end_time)
    .gt("end_time", slot.start_time)
    .limit(1);

  if (excludedId) overlapQuery = overlapQuery.neq("id", excludedId);
  const { data: overlaps, error: overlapError } = await overlapQuery;
  if (overlapError) throw new Error(overlapError.message);
  if (overlaps && overlaps.length > 0) {
    throw new Error("This service already has an overlapping slot");
  }
}

export function availabilityWriteError(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23P01"
  ) {
    return "This service already has an overlapping slot";
  }

  return error instanceof Error ? error.message : fallback;
}
