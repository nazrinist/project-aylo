import { z } from "zod";

export const ServiceInputSchema = z.object({
  business_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().default(null),
  price: z.number().min(0).max(10000),
  currency: z.literal("AZN").default("AZN"),
  duration_minutes: z.number().int().min(15).max(480),
  active: z.boolean().default(true),
});

export const ServiceUpdateSchema = ServiceInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const ServiceIdSchema = z.string().uuid();

export type ServiceInput = z.infer<typeof ServiceInputSchema>;

export type Service = {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  description: string | null;
  price: number;
  currency: "AZN";
  duration_minutes: number;
  active: boolean;
  created_at: string;
};
