import { z } from "zod";

export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export const ANALYTICS_BOOKING_STATUSES = [
  "pending_confirmation",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export const AnalyticsRangeSchema = z.enum(ANALYTICS_RANGES);
export const AnalyticsBookingStatusSchema = z.enum(
  ANALYTICS_BOOKING_STATUSES,
);

export const AnalyticsQuerySchema = z
  .object({
    businessId: z.string().uuid().optional(),
    range: AnalyticsRangeSchema.default("30d"),
  })
  .strict();

export type AnalyticsRange = z.infer<typeof AnalyticsRangeSchema>;
export type AnalyticsBookingStatus = z.infer<
  typeof AnalyticsBookingStatusSchema
>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type AnalyticsSource = "operations" | "catalog" | "demo";

export type AnalyticsBusinessOption = {
  id: string;
  name: string;
};

export type AnalyticsBookingInput = {
  status: AnalyticsBookingStatus;
  price: number | null;
  currency: string;
  createdAt: string;
  respondedAt: string | null;
  serviceId: string | null;
  serviceName: string;
};

export type AnalyticsWindow = {
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  days: number;
  label: string;
};

export type AnalyticsMoneyTotal = {
  currency: string;
  amount: number;
};

export type AnalyticsStatusCounts = {
  all: number;
  pendingConfirmation: number;
  accepted: number;
  rejected: number;
  cancelled: number;
};

export type AnalyticsDailyPoint = {
  date: string;
  totalLeads: number;
  acceptedBookings: number;
};

export type AnalyticsServicePerformance = {
  serviceId: string | null;
  serviceName: string;
  totalLeads: number;
  acceptedBookings: number;
  acceptanceRate: number | null;
  acceptedValue: AnalyticsMoneyTotal[];
};

export type AnalyticsSummary = {
  business: AnalyticsBusinessOption;
  window: AnalyticsWindow;
  metrics: {
    totalLeads: number;
    acceptedBookings: number;
    acceptanceRate: number | null;
    averageResponseHours: number | null;
    acceptedValue: AnalyticsMoneyTotal[];
  };
  statusCounts: AnalyticsStatusCounts;
  dailyTrend: AnalyticsDailyPoint[];
  services: AnalyticsServicePerformance[];
};

export type AnalyticsData = {
  source: AnalyticsSource;
  liveData: boolean;
  analyticsAvailable: boolean;
  businesses: AnalyticsBusinessOption[];
  selectedBusinessId: string | null;
  range: AnalyticsRange;
  summary: AnalyticsSummary | null;
};

export type AnalyticsApiResponse =
  | ({ ok: true } & AnalyticsData)
  | { ok: false; code: string; error: string };
