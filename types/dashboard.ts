import { z } from "zod";

export const DashboardQuerySchema = z
  .object({
    businessId: z.string().uuid().optional(),
  })
  .strict();

export type DashboardSource = "operations" | "catalog" | "demo";

export type DashboardBusinessOption = {
  id: string;
  name: string;
};

export type DashboardBusinessSummary = {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  verified: boolean;
};

export type DashboardServiceSummary = {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  durationMinutes: number | null;
  active: boolean;
};

export type DashboardSlotStatus = "available" | "held" | "booked" | "blocked";

export type DashboardSlotSummary = {
  id: string;
  serviceId: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: DashboardSlotStatus;
};

export type DashboardReadinessItem = {
  id: "verified" | "address" | "service" | "availability";
  label: string;
  complete: boolean;
};

export type DashboardSummary = {
  business: DashboardBusinessSummary;
  window: {
    start: string;
    end: string;
    label: string;
  };
  metrics: {
    activeServices: number;
    totalServices: number;
    openSlots: number;
    pendingBookings: number | null;
    bookedSlots: number | null;
  };
  readiness: {
    completed: number;
    total: number;
    items: DashboardReadinessItem[];
  };
  services: DashboardServiceSummary[];
  upcomingSlots: DashboardSlotSummary[];
};

export type DashboardData = {
  source: DashboardSource;
  privateMetrics: boolean;
  businesses: DashboardBusinessOption[];
  dashboard: DashboardSummary | null;
};

export type DashboardApiResponse =
  | ({ ok: true } & DashboardData)
  | { ok: false; code: string; error: string };
