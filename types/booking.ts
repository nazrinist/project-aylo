import { z } from "zod";

export type BookingDraft = {
  requestId: string | null;
  bookingToken: string | null;
  availabilityId: string;
  businessId: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  address: string;
  bookedFor: string;
  durationMinutes: number | null;
  price: number;
  currency: string;
};

export type BookingConfirmation = BookingDraft & {
  userConfirmed: true;
  confirmedAt: string;
};

export const BookingCreateInputSchema = z.object({
  requestId: z.string().uuid(),
  availabilityId: z.string().uuid(),
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  bookedFor: z.string().datetime({ offset: true }),
  expectedPrice: z.number().finite().nonnegative().max(1_000_000),
  expectedCurrency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  bookingToken: z.string().regex(/^[a-f0-9]{64}$/),
  userConfirmed: z.literal(true),
}).strict();

export type BookingCreateInput = z.infer<typeof BookingCreateInputSchema>;

export type BookingOfferClaims = Omit<
  BookingCreateInput,
  "bookingToken" | "userConfirmed"
>;

export type BookingStatus =
  | "pending_confirmation"
  | "accepted"
  | "rejected"
  | "cancelled";

export type PersistedBooking = {
  id: string;
  requestId: string;
  availabilityId: string;
  businessId: string;
  serviceId: string;
  bookedFor: string;
  price: number;
  currency: string;
  status: BookingStatus;
  userConfirmedAt: string;
  createdAt: string;
};

export type BookingSaveResult = {
  booking: PersistedBooking;
  created: boolean;
};

export type BookingSubmissionResult =
  | { status: "saved"; booking: PersistedBooking }
  | { status: "local"; booking: null };
