import type { FunctionTool } from "openai/resources/responses/responses";
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

export const CheckAvailabilityToolInputSchema = z
  .object({
    service_ids: z
      .array(z.string().uuid())
      .min(1)
      .max(250)
      .transform((ids) => [...new Set(ids)]),
    date: DateSchema,
    time_from: TimeSchema.nullable(),
    time_to: TimeSchema.nullable(),
    limit: z.number().int().min(1).max(500),
  })
  .strict();

export type CheckAvailabilityToolInput = z.infer<
  typeof CheckAvailabilityToolInputSchema
>;

export const CHECK_AVAILABILITY_TOOL = {
  type: "function",
  name: "checkAvailability",
  description:
    "Find available appointment slots for provider service IDs on a given date and optional time window in Asia/Baku. A single preferred time uses a plus-or-minus 60 minute window.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      service_ids: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1,
        maxItems: 250,
        uniqueItems: true,
        description: "Service IDs returned by searchProviders.",
      },
      date: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Appointment date in YYYY-MM-DD format.",
      },
      time_from: {
        type: ["string", "null"],
        pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
        description: "Preferred or earliest time in HH:mm, or null.",
      },
      time_to: {
        type: ["string", "null"],
        pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
        description: "Latest time in HH:mm, or null.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 500,
        description: "Maximum available slots to return.",
      },
    },
    required: ["service_ids", "date", "time_from", "time_to", "limit"],
    additionalProperties: false,
  },
} satisfies FunctionTool;
