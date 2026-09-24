import { z } from "zod";

export const SUPPORTED_SERVICES = [
  "hair",
  "makeup",
  "nails",
  "lashes",
  "brows",
] as const;

export type SupportedService = (typeof SUPPORTED_SERVICES)[number];

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

const BudgetSchema = z.number().finite().nonnegative().max(1_000_000);

export const IntentSchema = z
  .object({
    category: z.enum(["beauty", "unknown"]),
    services: z
      .array(z.enum(SUPPORTED_SERVICES))
      .max(SUPPORTED_SERVICES.length)
      .transform((services) => [...new Set(services)])
      .default([]),
    location: z.string().trim().min(1).max(200).nullable(),
    date: DateSchema.nullable(),
    time_from: TimeSchema.nullable(),
    time_to: TimeSchema.nullable(),
    budget_min: BudgetSchema.nullable(),
    budget_max: BudgetSchema.nullable(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default("AZN"),
    missing_fields: z
      .array(z.string().trim().min(1).max(100))
      .max(10)
      .default([]),
    original_request: z
      .string()
      .max(1000)
      .refine(
        (value) => value.trim().length >= 3,
        "Original request is too short",
      ),
  })
  .strict()
  .superRefine((intent, context) => {
    if (intent.category === "unknown" && intent.services.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Unknown categories cannot contain supported beauty services",
        path: ["services"],
      });
    }
  })
  .refine(
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
