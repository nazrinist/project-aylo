import { z } from "zod";

export const LEAD_STATUSES = [
  "pending_confirmation",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export const LEAD_FILTERS = ["all", ...LEAD_STATUSES] as const;
export const LEAD_DECISIONS = ["accepted", "rejected"] as const;

export const LeadStatusSchema = z.enum(LEAD_STATUSES);
export const LeadFilterSchema = z.enum(LEAD_FILTERS);
export const LeadDecisionSchema = z.enum(LEAD_DECISIONS);

export const LeadQuerySchema = z
  .object({
    businessId: z.string().uuid().optional(),
    status: LeadFilterSchema.default("pending_confirmation"),
  })
  .strict();

export const LeadDecisionInputSchema = z
  .object({
    actionToken: z.string().min(32).max(2_048),
    decision: LeadDecisionSchema,
    confirmed: z.literal(true),
  })
  .strict();

export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type LeadFilter = z.infer<typeof LeadFilterSchema>;
export type LeadQuery = z.infer<typeof LeadQuerySchema>;
export type LeadDecision = z.infer<typeof LeadDecisionSchema>;
export type LeadDecisionInput = z.infer<typeof LeadDecisionInputSchema>;
export type LeadSource = "operations" | "catalog" | "demo";

export type LeadBusinessOption = {
  id: string;
  name: string;
};

export type LeadSummary = {
  reference: string;
  serviceName: string;
  bookedFor: string;
  price: number | null;
  currency: string;
  status: LeadStatus;
  receivedAt: string;
  actionToken: string | null;
};

export type LeadCounts = Record<LeadFilter, number | null>;

export type LeadInboxData = {
  source: LeadSource;
  liveData: boolean;
  leadsAvailable: boolean;
  businesses: LeadBusinessOption[];
  selectedBusinessId: string | null;
  filter: LeadFilter;
  counts: LeadCounts;
  leads: LeadSummary[];
  resultsLimited: boolean;
};

export type LeadApiResponse =
  | ({ ok: true } & LeadInboxData)
  | { ok: false; code: string; error: string };

export type LeadDecisionResult = {
  reference: string;
  status: LeadDecision;
  respondedAt: string;
  changed: boolean;
};

export type LeadDecisionApiResponse =
  | ({ ok: true } & LeadDecisionResult)
  | { ok: false; code: string; error: string };
