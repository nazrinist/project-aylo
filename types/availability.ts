import { z } from "zod";

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const AVAILABILITY_STATUSES = [
  "available",
  "held",
  "booked",
  "blocked",
] as const;
export const AVAILABILITY_FILTERS = ["all", ...AVAILABILITY_STATUSES] as const;

export const AvailabilityStatusSchema = z.enum(AVAILABILITY_STATUSES);
export const AvailabilityFilterSchema = z.enum(AVAILABILITY_FILTERS);

export const BakuDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }, "Date is invalid");

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
  date: BakuDateSchema,
});

export const AvailabilityManagementQuerySchema = z
  .object({
    businessId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    startDate: BakuDateSchema,
  })
  .strict();

const AvailabilityMutationSlotFields = {
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startTime: IsoDateTimeSchema,
  endTime: IsoDateTimeSchema,
};

export const AvailabilityMutationInputSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("create"),
        ...AvailabilityMutationSlotFields,
        confirmed: z.literal(true),
      })
      .strict(),
    z
      .object({
        action: z.literal("update"),
        slotId: z.string().uuid(),
        ...AvailabilityMutationSlotFields,
        confirmed: z.literal(true),
      })
      .strict(),
    z
      .object({
        action: z.literal("set_status"),
        slotId: z.string().uuid(),
        businessId: z.string().uuid(),
        targetStatus: z.enum(["available", "blocked"]),
        confirmed: z.literal(true),
      })
      .strict(),
    z
      .object({
        action: z.literal("delete"),
        slotId: z.string().uuid(),
        businessId: z.string().uuid(),
        confirmed: z.literal(true),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (value.action !== "create" && value.action !== "update") return;

    const start = new Date(value.startTime).getTime();
    const end = new Date(value.endTime).getTime();
    if (end <= start) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }
    if (end - start > 12 * 60 * 60 * 1000) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "A slot cannot be longer than 12 hours",
      });
    }
  });

export type AvailabilityInput = z.infer<typeof AvailabilityInputSchema>;
export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;
export type AvailabilityFilter = z.infer<typeof AvailabilityFilterSchema>;
export type AvailabilityManagementQuery = z.infer<
  typeof AvailabilityManagementQuerySchema
>;
export type AvailabilityMutationInput = z.infer<
  typeof AvailabilityMutationInputSchema
>;

export type Availability = {
  id: string;
  business_id: string;
  business_name: string;
  service_id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  status: AvailabilityStatus;
  created_at: string;
};

export type AvailabilitySource = "operations" | "catalog" | "demo";

export type AvailabilityBusinessOption = {
  id: string;
  name: string;
};

export type AvailabilityServiceOption = {
  id: string;
  businessId: string;
  name: string;
  durationMinutes: number | null;
  active: boolean;
};

export type AvailabilitySlotSummary = {
  id: string;
  businessId: string;
  serviceId: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
};

export type AvailabilityCounts = Record<
  AvailabilityFilter,
  number | null
>;

export type AvailabilityManagementData = {
  source: AvailabilitySource;
  liveData: boolean;
  canManage: boolean;
  persistent: boolean;
  businesses: AvailabilityBusinessOption[];
  services: AvailabilityServiceOption[];
  selectedBusinessId: string | null;
  selectedServiceId: string | null;
  window: {
    startDate: string;
    endDate: string;
    start: string;
    end: string;
    label: string;
  };
  counts: AvailabilityCounts;
  slots: AvailabilitySlotSummary[];
  resultsLimited: boolean;
};

export type AvailabilityManagementApiResponse =
  | ({ ok: true } & AvailabilityManagementData)
  | { ok: false; code: string; error: string };

export type AvailabilityMutationResult = {
  action: AvailabilityMutationInput["action"];
  changed: boolean;
  slot: AvailabilitySlotSummary | null;
};

export type AvailabilityMutationApiResponse =
  | ({ ok: true } & AvailabilityMutationResult)
  | { ok: false; code: string; error: string };
