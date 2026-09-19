import type { FunctionTool } from "openai/resources/responses/responses";
import { z } from "zod";

export const SearchProvidersToolInputSchema = z
  .object({
    category: z.enum(["beauty", "unknown"]),
    services: z.array(z.string().trim().min(1).max(100)).max(10),
    location: z.string().trim().min(1).max(200).nullable(),
    budget_min: z.number().nonnegative().nullable(),
    budget_max: z.number().nonnegative().nullable(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    limit: z.number().int().min(1).max(250),
  })
  .strict()
  .refine(
    (input) =>
      input.budget_min === null ||
      input.budget_max === null ||
      input.budget_min <= input.budget_max,
    {
      message: "Minimum budget cannot exceed maximum budget",
      path: ["budget_max"],
    },
  );

export type SearchProvidersToolInput = z.infer<typeof SearchProvidersToolInputSchema>;

export const SEARCH_PROVIDERS_TOOL = {
  type: "function",
  name: "searchProviders",
  description:
    "Find active provider services that satisfy the requested service, Baku area, budget, and currency constraints. This does not check appointment availability.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["beauty", "unknown"],
        description: "The supported marketplace category.",
      },
      services: {
        type: "array",
        items: { type: "string" },
        description: "All requested services; every item must be covered.",
      },
      location: {
        type: ["string", "null"],
        description: "Requested area in Baku, or null when unknown.",
      },
      budget_min: {
        type: ["number", "null"],
        minimum: 0,
        description: "Minimum total service price, or null.",
      },
      budget_max: {
        type: ["number", "null"],
        minimum: 0,
        description: "Maximum total service price, or null.",
      },
      currency: {
        type: "string",
        minLength: 3,
        maxLength: 3,
        description: "ISO-style three-letter currency code, normally AZN.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 250,
        description: "Maximum provider services to return.",
      },
    },
    required: [
      "category",
      "services",
      "location",
      "budget_min",
      "budget_max",
      "currency",
      "limit",
    ],
    additionalProperties: false,
  },
} satisfies FunctionTool;
