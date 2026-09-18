import { z } from "zod";

const IsoDateTimeSchema = z.string().datetime({ offset: true });

const AvailabilityFieldsSchema = z.object({
  business_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: IsoDateTimeSchema,
  end_time: IsoDateTimeSchema,
  status: z.literal("available").default("available"),
});

export const AvailabilityInputSchema = AvailabilityFieldsSchema
  .refine((value) => new Date(value.end_time) > new Date(value.start_time), {
    message: "End time must be after start time",
    path: ["end_time"],
  })
  .refine(
    (value) =>
      new Date(value.end_time).getTime() - new Date(value.start_time).getTime() <=
      12 * 60 * 60 * 1000,
    {
      message: "A slot cannot be longer than 12 hours",
      path: ["end_time"],
    },
  );

export const AvailabilityUpdateSchema = AvailabilityFieldsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const AvailabilityIdSchema = z.string().uuid();

export const AvailabilityQuerySchema = z.object({
  businessId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00+04:00`).getTime()), {
      message: "Date is invalid",
    }),
});

export type AvailabilityInput = z.infer<typeof AvailabilityInputSchema>;

export type Availability = {
  id: string;
  business_id: string;
  business_name: string;
  service_id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  status: "available";
  created_at: string;
};
