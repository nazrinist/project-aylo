import { z } from "zod";

export const IntentSchema = z.object({
  category: z.enum(["beauty", "unknown"]),
  services: z.array(z.string()).default([]),
  location: z.string().nullable(),
  date: z.string().nullable(),
  time_from: z.string().nullable(),
  time_to: z.string().nullable(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
  currency: z.string().default("AZN"),
  missing_fields: z.array(z.string()).default([]),
  original_request: z.string(),
});

export type Intent = z.infer<typeof IntentSchema>;
