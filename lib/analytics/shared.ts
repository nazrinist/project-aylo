import type {
  AnalyticsBookingInput,
  AnalyticsBookingStatus,
  AnalyticsBusinessOption,
  AnalyticsMoneyTotal,
  AnalyticsRange,
  AnalyticsServicePerformance,
  AnalyticsStatusCounts,
  AnalyticsSummary,
  AnalyticsWindow,
} from "@/types/analytics";

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const bakuDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Baku",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function round(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function dateKey(date: Date) {
  return bakuDateFormatter.format(date);
}

function moveDateKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function validDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeMoney(
  bookings: AnalyticsBookingInput[],
): AnalyticsMoneyTotal[] {
  const totals = new Map<string, number>();

  for (const booking of bookings) {
    if (
      booking.status !== "accepted" ||
      booking.price === null ||
      !Number.isFinite(booking.price) ||
      booking.price < 0
    ) {
      continue;
    }

    const currency = booking.currency.trim().toUpperCase() || "UNKNOWN";
    totals.set(currency, (totals.get(currency) ?? 0) + booking.price);
  }

  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount: round(amount, 2) }))
    .sort((left, right) => left.currency.localeCompare(right.currency, "en"));
}

function acceptanceRate(accepted: number, rejected: number) {
  const decided = accepted + rejected;
  return decided === 0 ? null : round((accepted / decided) * 100);
}

function responseAverage(bookings: AnalyticsBookingInput[]) {
  const responseHours = bookings.flatMap((booking) => {
    if (
      (booking.status !== "accepted" && booking.status !== "rejected") ||
      !booking.respondedAt
    ) {
      return [];
    }

    const createdAt = validDate(booking.createdAt);
    const respondedAt = validDate(booking.respondedAt);
    if (!createdAt || !respondedAt || respondedAt < createdAt) return [];

    return [(respondedAt.getTime() - createdAt.getTime()) / (60 * 60 * 1000)];
  });

  if (responseHours.length === 0) return null;
  return round(
    responseHours.reduce((total, hours) => total + hours, 0) /
      responseHours.length,
  );
}

function statusCounts(bookings: AnalyticsBookingInput[]): AnalyticsStatusCounts {
  const count = (status: AnalyticsBookingStatus) =>
    bookings.filter((booking) => booking.status === status).length;

  return {
    all: bookings.length,
    pendingConfirmation: count("pending_confirmation"),
    accepted: count("accepted"),
    rejected: count("rejected"),
    cancelled: count("cancelled"),
  };
}

function servicePerformance(
  bookings: AnalyticsBookingInput[],
): AnalyticsServicePerformance[] {
  const groups = new Map<string, AnalyticsBookingInput[]>();

  for (const booking of bookings) {
    const key = booking.serviceId ?? `unknown:${booking.serviceName}`;
    groups.set(key, [...(groups.get(key) ?? []), booking]);
  }

  return [...groups.values()]
    .map((serviceBookings): AnalyticsServicePerformance => {
      const accepted = serviceBookings.filter(
        (booking) => booking.status === "accepted",
      ).length;
      const rejected = serviceBookings.filter(
        (booking) => booking.status === "rejected",
      ).length;
      const first = serviceBookings[0];

      return {
        serviceId: first.serviceId,
        serviceName: first.serviceName,
        totalLeads: serviceBookings.length,
        acceptedBookings: accepted,
        acceptanceRate: acceptanceRate(accepted, rejected),
        acceptedValue: normalizeMoney(serviceBookings),
      };
    })
    .sort(
      (left, right) =>
        right.totalLeads - left.totalLeads ||
        right.acceptedBookings - left.acceptedBookings ||
        left.serviceName.localeCompare(right.serviceName, "en"),
    )
    .slice(0, 5);
}

export function buildAnalyticsWindow(
  range: AnalyticsRange,
  now: Date,
): AnalyticsWindow {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Analytics window requires a valid date");
  }

  const days = RANGE_DAYS[range];
  const endDate = dateKey(now);
  const startDate = moveDateKey(endDate, -(days - 1));
  const exclusiveEndDate = moveDateKey(endDate, 1);

  return {
    start: new Date(`${startDate}T00:00:00+04:00`).toISOString(),
    end: new Date(`${exclusiveEndDate}T00:00:00+04:00`).toISOString(),
    startDate,
    endDate,
    days,
    label: `Last ${days} days`,
  };
}

export function buildAnalyticsSummary({
  business,
  bookings,
  range,
  now,
}: {
  business: AnalyticsBusinessOption;
  bookings: AnalyticsBookingInput[];
  range: AnalyticsRange;
  now: Date;
}): AnalyticsSummary {
  const window = buildAnalyticsWindow(range, now);
  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();
  const filtered = bookings.filter((booking) => {
    const createdAt = validDate(booking.createdAt)?.getTime();
    return (
      createdAt !== undefined &&
      createdAt !== null &&
      createdAt >= start &&
      createdAt < end
    );
  });
  const counts = statusCounts(filtered);
  const trend = new Map(
    Array.from({ length: window.days }, (_, index) => {
      const date = moveDateKey(window.startDate, index);
      return [date, { date, totalLeads: 0, acceptedBookings: 0 }];
    }),
  );

  for (const booking of filtered) {
    const createdAt = validDate(booking.createdAt);
    if (!createdAt) continue;
    const point = trend.get(dateKey(createdAt));
    if (!point) continue;
    point.totalLeads += 1;
    if (booking.status === "accepted") point.acceptedBookings += 1;
  }

  return {
    business,
    window,
    metrics: {
      totalLeads: counts.all,
      acceptedBookings: counts.accepted,
      acceptanceRate: acceptanceRate(counts.accepted, counts.rejected),
      averageResponseHours: responseAverage(filtered),
      acceptedValue: normalizeMoney(filtered),
    },
    statusCounts: counts,
    dailyTrend: [...trend.values()],
    services: servicePerformance(filtered),
  };
}
