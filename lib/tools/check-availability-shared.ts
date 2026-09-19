import type { AvailabilitySlot } from "@/types/availability-tool";
import type { ProviderCandidate } from "@/types/provider";
import type { CheckAvailabilityToolInput } from "./check-availability-contract";
import { timeMatches } from "../search/shared";

const DEMO_TIMES = ["10:00", "14:00", "18:00"] as const;

function toBakuIso(date: Date) {
  const shifted = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+04:00`;
}

export function compareAvailabilitySlots(a: AvailabilitySlot, b: AvailabilitySlot) {
  return (
    a.startTime.localeCompare(b.startTime) ||
    a.serviceId.localeCompare(b.serviceId) ||
    a.id.localeCompare(b.id)
  );
}

export function filterAvailabilitySlots(
  slots: AvailabilitySlot[],
  input: CheckAvailabilityToolInput,
) {
  const requestedIds = new Set(input.service_ids);
  return slots
    .filter(
      (slot) =>
        requestedIds.has(slot.serviceId) &&
        timeMatches(slot.startTime, input),
    )
    .sort(compareAvailabilitySlots)
    .slice(0, input.limit);
}

export function buildDemoAvailabilitySlots(
  providers: ProviderCandidate[],
  input: CheckAvailabilityToolInput,
) {
  const requestedIds = new Set(input.service_ids);
  const slots = providers
    .filter((provider) => requestedIds.has(provider.serviceId))
    .flatMap((provider) =>
      DEMO_TIMES.map((time) => {
        const startTime = `${input.date}T${time}:00+04:00`;
        const duration = provider.durationMinutes ?? 60;
        const endTime = toBakuIso(
          new Date(new Date(startTime).getTime() + duration * 60 * 1000),
        );
        return {
          id: `demo-slot-${provider.serviceId}-${input.date}-${time.replace(":", "")}`,
          businessId: provider.businessId,
          serviceId: provider.serviceId,
          startTime,
          endTime,
        } satisfies AvailabilitySlot;
      }),
    );

  return filterAvailabilitySlots(slots, input);
}
