import { z } from "zod";

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Date is invalid");

const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:mm");

export const IntentSchema = z.object({
  category: z.enum(["beauty", "unknown"]),
  services: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  location: z.string().trim().min(1).max(200).nullable(),
  date: DateSchema.nullable(),
  time_from: TimeSchema.nullable(),
  time_to: TimeSchema.nullable(),
  budget_min: z.number().nonnegative().nullable(),
  budget_max: z.number().nonnegative().nullable(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("AZN"),
  missing_fields: z.array(z.string()).default([]),
  original_request: z.string().max(1000),
}).refine(
  (intent) =>
    intent.budget_min === null ||
    intent.budget_max === null ||
    intent.budget_min <= intent.budget_max,
  {
    message: "Minimum budget cannot exceed maximum budget",
    path: ["budget_max"],
  },
);

export type Intent = z.infer<typeof IntentSchema>;
