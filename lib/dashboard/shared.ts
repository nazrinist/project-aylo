import type {
  DashboardBusinessSummary,
  DashboardServiceSummary,
  DashboardSlotSummary,
  DashboardSummary,
} from "@/types/dashboard";

export const DASHBOARD_WINDOW_DAYS = 30;

type DashboardSummaryInput = {
  business: DashboardBusinessSummary;
  services: DashboardServiceSummary[];
  upcomingSlots: DashboardSlotSummary[];
  openSlotCount: number;
  pendingBookingCount: number | null;
  bookedSlotCount: number | null;
  now: Date;
};

function nonNegativeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function buildDashboardWindow(now: Date) {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Dashboard window requires a valid date");
  }

  return {
    start: now.toISOString(),
    end: new Date(
      now.getTime() + DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
    label: `Next ${DASHBOARD_WINDOW_DAYS} days`,
  };
}

export function buildDashboardSummary({
  business,
  services,
  upcomingSlots,
  openSlotCount,
  pendingBookingCount,
  bookedSlotCount,
  now,
}: DashboardSummaryInput): DashboardSummary {
  const activeServices = services.filter((service) => service.active).length;
  const openSlots = nonNegativeCount(openSlotCount);
  const readinessItems: DashboardSummary["readiness"]["items"] = [
    {
      id: "verified",
      label: "Business verified",
      complete: business.verified,
    },
    {
      id: "address",
      label: "Address added",
      complete: Boolean(business.address?.trim()),
    },
    {
      id: "service",
      label: "Active service published",
      complete: activeServices > 0,
    },
    {
      id: "availability",
      label: "Open slot in the next 30 days",
      complete: openSlots > 0,
    },
  ];

  return {
    business,
    window: buildDashboardWindow(now),
    metrics: {
      activeServices,
      totalServices: services.length,
      openSlots,
      pendingBookings:
        pendingBookingCount === null
          ? null
          : nonNegativeCount(pendingBookingCount),
      bookedSlots:
        bookedSlotCount === null ? null : nonNegativeCount(bookedSlotCount),
    },
    readiness: {
      completed: readinessItems.filter((item) => item.complete).length,
      total: readinessItems.length,
      items: readinessItems,
    },
    services: [...services].sort(
      (left, right) =>
        Number(right.active) - Number(left.active) ||
        left.name.localeCompare(right.name, "en"),
    ),
    upcomingSlots: [...upcomingSlots].sort((left, right) =>
      left.startTime.localeCompare(right.startTime),
    ),
  };
}
