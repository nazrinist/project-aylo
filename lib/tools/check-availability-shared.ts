import type { AvailabilitySlot } from "@/types/availability-tool";
import type { ProviderCandidate } from "@/types/provider";
import type { CheckAvailabilityToolInput } from "./check-availability-contract";
import {
  addBakuCalendarDays,
  assertCurrentAvailabilityRequest,
  bakuDateTimeParts,
  isOvernightWindow,
} from "../search/edge-cases";
import { timeMatches } from "../search/shared";

const DEMO_TIMES = ["10:00", "14:00", "18:00"] as const;
const MAX_SLOT_DURATION_MS = 12 * 60 * 60 * 1000;

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

export function availabilityQueryBounds(input: CheckAvailabilityToolInput) {
  if (isOvernightWindow(input)) {
    return {
      start: `${input.date}T${input.time_from}:00+04:00`,
      end: `${addBakuCalendarDays(input.date, 1)}T${input.time_to}:00+04:00`,
      inclusiveEnd: true,
    } as const;
  }

  return {
    start: `${input.date}T00:00:00+04:00`,
    end: `${addBakuCalendarDays(input.date, 1)}T00:00:00+04:00`,
    inclusiveEnd: false,
  } as const;
}

function validSlotTimes(slot: AvailabilitySlot) {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  const duration = end.getTime() - start.getTime();
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    duration <= 0 ||
    duration > MAX_SLOT_DURATION_MS
  ) {
    return null;
  }
  return { start, end };
}

function slotMatchesRequestedWindow(
  slot: AvailabilitySlot,
  input: CheckAvailabilityToolInput,
) {
  const parts = bakuDateTimeParts(new Date(slot.startTime));
  if (!isOvernightWindow(input)) {
    return parts.date === input.date && timeMatches(slot.startTime, input);
  }

  const fromValue = input.time_from;
  const toValue = input.time_to;
  if (!fromValue || !toValue) return false;
  const [fromHours, fromMinutes] = fromValue.split(":").map(Number);
  const [toHours, toMinutes] = toValue.split(":").map(Number);
  const from = fromHours * 60 + fromMinutes;
  const to = toHours * 60 + toMinutes;

  if (parts.date === input.date) return parts.minutes >= from;
  return (
    parts.date === addBakuCalendarDays(input.date, 1) &&
    parts.minutes <= to
  );
}

export function filterAvailabilitySlots(
  slots: AvailabilitySlot[],
  input: CheckAvailabilityToolInput,
  now = new Date(),
) {
  assertCurrentAvailabilityRequest(input, now);
  const requestedIds = new Set(input.service_ids);
  const uniqueServiceTimes = new Set<string>();

  return [...slots]
    .sort(compareAvailabilitySlots)
    .filter((slot) => {
      if (!requestedIds.has(slot.serviceId)) return false;
      const times = validSlotTimes(slot);
      if (!times || times.start.getTime() <= now.getTime()) return false;
      if (!slotMatchesRequestedWindow(slot, input)) return false;

      const uniqueKey = `${slot.serviceId}\u0000${times.start.toISOString()}`;
      if (uniqueServiceTimes.has(uniqueKey)) return false;
      uniqueServiceTimes.add(uniqueKey);
      return true;
    })
    .slice(0, input.limit);
}

export function buildDemoAvailabilitySlots(
  providers: ProviderCandidate[],
  input: CheckAvailabilityToolInput,
  now = new Date(),
) {
  const requestedIds = new Set(input.service_ids);
  const dates = isOvernightWindow(input)
    ? [input.date, addBakuCalendarDays(input.date, 1)]
    : [input.date];
  const slots = providers
    .filter((provider) => requestedIds.has(provider.serviceId))
    .flatMap((provider) =>
      dates.flatMap((date) =>
        DEMO_TIMES.map((time) => {
          const startTime = `${date}T${time}:00+04:00`;
          const duration = provider.durationMinutes ?? 60;
          const endTime = toBakuIso(
            new Date(new Date(startTime).getTime() + duration * 60 * 1000),
          );
          return {
            id: `demo-slot-${provider.serviceId}-${date}-${time.replace(":", "")}`,
            businessId: provider.businessId,
            serviceId: provider.serviceId,
            startTime,
            endTime,
          } satisfies AvailabilitySlot;
        }),
      ),
    );

  return filterAvailabilitySlots(slots, input, now);
}
