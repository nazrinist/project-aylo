import type {
  AvailabilityCounts,
  AvailabilityFilter,
  AvailabilityManagementData,
  AvailabilityMutationInput,
  AvailabilityServiceOption,
  AvailabilitySlotSummary,
  AvailabilityStatus,
} from "@/types/availability";

export const AVAILABILITY_WINDOW_DAYS = 7;
export const AVAILABILITY_MANAGEMENT_LIMIT = 200;

const ACTIVE_SLOT_STATUSES = new Set<AvailabilityStatus>([
  "available",
  "held",
  "booked",
]);

function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function buildAvailabilityWindow(startDate: string) {
  const start = new Date(`${startDate}T00:00:00+04:00`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Availability window requires a valid Baku date");
  }

  const endExclusiveDate = addCalendarDays(startDate, AVAILABILITY_WINDOW_DAYS);
  const endDate = addCalendarDays(startDate, AVAILABILITY_WINDOW_DAYS - 1);

  return {
    startDate,
    endDate,
    start: start.toISOString(),
    end: new Date(`${endExclusiveDate}T00:00:00+04:00`).toISOString(),
    label: `${startDate} – ${endDate}`,
  };
}

export function sortAvailabilitySlots(slots: AvailabilitySlotSummary[]) {
  return [...slots].sort(
    (left, right) =>
      left.startTime.localeCompare(right.startTime) ||
      left.serviceName.localeCompare(right.serviceName, "en") ||
      left.id.localeCompare(right.id),
  );
}

export function filterAvailabilitySlots(
  slots: AvailabilitySlotSummary[],
  filter: AvailabilityFilter,
) {
  if (filter === "all") return sortAvailabilitySlots(slots);
  return sortAvailabilitySlots(slots.filter((slot) => slot.status === filter));
}

export function buildAvailabilityCounts(
  slots: AvailabilitySlotSummary[],
): AvailabilityCounts {
  const counts: AvailabilityCounts = {
    all: slots.length,
    available: 0,
    held: 0,
    booked: 0,
    blocked: 0,
  };

  for (const slot of slots) {
    counts[slot.status] = (counts[slot.status] ?? 0) + 1;
  }
  return counts;
}

export function catalogAvailabilityCounts(available: number): AvailabilityCounts {
  const safe = Number.isFinite(available) ? Math.max(0, Math.trunc(available)) : 0;
  return {
    all: safe,
    available: safe,
    held: null,
    booked: null,
    blocked: null,
  };
}

export function isProtectedAvailabilityStatus(status: AvailabilityStatus) {
  return status === "held" || status === "booked";
}

function overlaps(
  left: Pick<AvailabilitySlotSummary, "startTime" | "endTime">,
  right: Pick<AvailabilitySlotSummary, "startTime" | "endTime">,
) {
  return (
    new Date(left.startTime).getTime() < new Date(right.endTime).getTime() &&
    new Date(left.endTime).getTime() > new Date(right.startTime).getTime()
  );
}

function assertDemoSlotWindow(
  candidate: Pick<AvailabilitySlotSummary, "id" | "serviceId" | "startTime" | "endTime" | "status">,
  slots: AvailabilitySlotSummary[],
) {
  if (new Date(candidate.startTime) >= new Date(candidate.endTime)) {
    throw new Error("End time must be after start time.");
  }

  if (!ACTIVE_SLOT_STATUSES.has(candidate.status)) return;
  const conflict = slots.some(
    (slot) =>
      slot.id !== candidate.id &&
      slot.serviceId === candidate.serviceId &&
      ACTIVE_SLOT_STATUSES.has(slot.status) &&
      overlaps(candidate, slot),
  );
  if (conflict) throw new Error("This service already has an overlapping active slot.");
}

export function applyDemoAvailabilityMutation(
  slots: AvailabilitySlotSummary[],
  services: AvailabilityServiceOption[],
  input: AvailabilityMutationInput,
  options: { newSlotId?: string; now?: Date } = {},
) {
  const newSlotId =
    options.newSlotId ?? "20000000-0000-4000-8000-000000000999";
  const now = options.now ?? new Date();
  const current = "slotId" in input
    ? slots.find(
        (slot) => slot.id === input.slotId && slot.businessId === input.businessId,
      )
    : undefined;

  if (input.action !== "create" && !current) {
    throw new Error("Availability slot was not found.");
  }
  if (current && isProtectedAvailabilityStatus(current.status)) {
    throw new Error("Held and booked slots are read-only.");
  }
  if (current && new Date(current.startTime).getTime() <= now.getTime()) {
    throw new Error("Past slots are read-only.");
  }

  if (input.action === "delete") {
    return {
      slots: slots.filter((slot) => slot.id !== input.slotId),
      changed: true,
      slot: null,
    };
  }

  if (input.action === "set_status") {
    if (!current) throw new Error("Availability slot was not found.");
    if (
      input.targetStatus === "available" &&
      !services.some(
        (service) => service.id === current.serviceId && service.active,
      )
    ) {
      throw new Error("Choose an active service before reopening this slot.");
    }
    if (current.status === input.targetStatus) {
      return { slots, changed: false, slot: current };
    }
    const updated = { ...current, status: input.targetStatus };
    assertDemoSlotWindow(updated, slots);
    return {
      slots: slots.map((slot) => (slot.id === updated.id ? updated : slot)),
      changed: true,
      slot: updated,
    };
  }

  const service = services.find(
    (candidate) =>
      candidate.id === input.serviceId &&
      candidate.businessId === input.businessId &&
      candidate.active,
  );
  if (!service) throw new Error("Choose an active service for this business.");
  if (new Date(input.startTime).getTime() <= now.getTime()) {
    throw new Error("Past slots are read-only.");
  }

  const updated: AvailabilitySlotSummary = {
    id: input.action === "update" ? input.slotId : newSlotId,
    businessId: input.businessId,
    serviceId: input.serviceId,
    serviceName: service.name,
    startTime: input.startTime,
    endTime: input.endTime,
    status: current?.status ?? "available",
  };
  assertDemoSlotWindow(updated, slots);

  return {
    slots:
      input.action === "create"
        ? sortAvailabilitySlots([...slots, updated])
        : sortAvailabilitySlots(
            slots.map((slot) => (slot.id === updated.id ? updated : slot)),
          ),
    changed: true,
    slot: updated,
  };
}

export function withAvailabilitySlots(
  data: AvailabilityManagementData,
  slots: AvailabilitySlotSummary[],
): AvailabilityManagementData {
  return {
    ...data,
    slots: sortAvailabilitySlots(slots),
    counts: buildAvailabilityCounts(slots),
    resultsLimited: false,
  };
}
