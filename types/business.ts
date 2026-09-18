import { z } from "zod";

export const BusinessInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.literal("beauty").default("beauty"),
  address: z.string().trim().min(2).max(200),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  verified: z.boolean().default(false),
});

export const BusinessUpdateSchema = BusinessInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const BusinessIdSchema = z.string().uuid();

export type BusinessInput = z.infer<typeof BusinessInputSchema>;

export type Business = {
  id: string;
  name: string;
  category: "beauty";
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  verified: boolean;
  created_at: string;
};
