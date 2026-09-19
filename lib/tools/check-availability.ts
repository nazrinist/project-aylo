import "server-only";

import type {
  AvailabilitySlot,
  CheckAvailabilityToolResult,
} from "@/types/availability-tool";
import { DEMO_PROVIDER_CATALOG } from "@/lib/search/demo-catalog";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { CheckAvailabilityToolInputSchema } from "./check-availability-contract";
import {
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
): Promise<CheckAvailabilityToolResult> {
  const input = CheckAvailabilityToolInputSchema.parse(rawInput);

  if (!isSupabaseConfigured()) {
    return {
      source: "demo",
      slots: buildDemoAvailabilitySlots(DEMO_PROVIDER_CATALOG, input),
    };
  }

  const dayStart = `${input.date}T00:00:00+04:00`;
  const next = new Date(`${input.date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = `${next.toISOString().slice(0, 10)}T00:00:00+04:00`;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("availability")
    .select("id,business_id,service_id,start_time,end_time")
    .in("service_id", input.service_ids)
    .eq("status", "available")
    .gte("start_time", dayStart)
    .lt("start_time", dayEnd)
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
    slots: filterAvailabilitySlots(slots, input),
  };
}
