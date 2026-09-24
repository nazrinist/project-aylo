import "server-only";

import type {
  AvailabilitySlot,
  CheckAvailabilityToolResult,
} from "@/types/availability-tool";
import { DEMO_PROVIDER_CATALOG } from "@/lib/search/demo-catalog";
import { assertCurrentAvailabilityRequest } from "@/lib/search/edge-cases";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { CheckAvailabilityToolInputSchema } from "./check-availability-contract";
import {
  availabilityQueryBounds,
  buildDemoAvailabilitySlots,
  filterAvailabilitySlots,
} from "./check-availability-shared";

type RawAvailability = {
  id: string;
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
};

export async function executeCheckAvailabilityTool(
  rawInput: unknown,
  now = new Date(),
): Promise<CheckAvailabilityToolResult> {
  const input = CheckAvailabilityToolInputSchema.parse(rawInput);
  assertCurrentAvailabilityRequest(input, now);

  if (!isSupabaseConfigured()) {
    return {
      source: "demo",
      slots: buildDemoAvailabilitySlots(DEMO_PROVIDER_CATALOG, input, now),
    };
  }

  const bounds = availabilityQueryBounds(input);

  const supabase = getSupabaseServerClient();
  const boundedQuery = supabase
    .from("availability")
    .select("id,business_id,service_id,start_time,end_time")
    .in("service_id", input.service_ids)
    .eq("status", "available")
    .gte("start_time", bounds.start);
  const { data, error } = await (
    bounds.inclusiveEnd
      ? boundedQuery.lte("start_time", bounds.end)
      : boundedQuery.lt("start_time", bounds.end)
  )
    .order("start_time", { ascending: true })
    .limit(500);

  if (error) throw new Error(`Availability search failed: ${error.message}`);

  const slots = ((data ?? []) as RawAvailability[]).map(
    (slot): AvailabilitySlot => ({
      id: slot.id,
      businessId: slot.business_id,
      serviceId: slot.service_id,
      startTime: slot.start_time,
      endTime: slot.end_time,
    }),
  );

  return {
    source: "supabase",
    slots: filterAvailabilitySlots(slots, input, now),
  };
}
