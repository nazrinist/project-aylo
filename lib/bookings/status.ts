import type {
  ConsumerBooking,
  ConsumerBookingStatus,
} from "@/types/booking";

type RelatedBusiness = {
  name: string;
  address: string | null;
};

type RelatedService = {
  name: string;
  duration_minutes: number | string | null;
};

export type ConsumerBookingRow = {
  id: string;
  booked_for: string;
  price: number | string | null;
  currency: string;
  status: string;
  created_at: string;
  merchant_responded_at: string | null;
  businesses: RelatedBusiness | RelatedBusiness[] | null;
  services: RelatedService | RelatedService[] | null;
};

const knownStatuses = new Set<ConsumerBookingStatus>([
  "pending_confirmation",
  "accepted",
  "rejected",
  "cancelled",
]);

function firstRelated<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function cleanText(value: string | null | undefined, fallback: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 300) : fallback;
}

function nullableText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 500) : null;
}

function nonNegativeNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function duration(value: number | string | null) {
  const parsed = nonNegativeNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 && parsed <= 1_440
    ? parsed
    : null;
}

function status(value: string): ConsumerBookingStatus {
  return knownStatuses.has(value as ConsumerBookingStatus)
    ? value as ConsumerBookingStatus
    : "unknown";
}

export function consumerBookingFromRow(row: ConsumerBookingRow): ConsumerBooking {
  const business = firstRelated(row.businesses);
  const service = firstRelated(row.services);
  const currency = row.currency.trim().toUpperCase();

  return {
    reference: row.id.slice(0, 8).toUpperCase(),
    businessName: cleanText(business?.name, "Unknown provider"),
    serviceName: cleanText(service?.name, "Unknown service"),
    address: nullableText(business?.address),
    bookedFor: row.booked_for,
    durationMinutes: duration(service?.duration_minutes ?? null),
    price: nonNegativeNumber(row.price),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "AZN",
    status: status(row.status),
    createdAt: row.created_at,
    merchantRespondedAt: row.merchant_responded_at,
  };
}

export function consumerBookingStatusText(status: ConsumerBookingStatus) {
  const content: Record<ConsumerBookingStatus, { label: string; detail: string }> = {
    pending_confirmation: {
      label: "Waiting for provider",
      detail: "Your request is saved and the provider has not decided yet.",
    },
    accepted: {
      label: "Accepted",
      detail: "The provider accepted your appointment request.",
    },
    rejected: {
      label: "Not accepted",
      detail: "The provider could not accept this appointment request.",
    },
    cancelled: {
      label: "Cancelled",
      detail: "This booking request is no longer active.",
    },
    unknown: {
      label: "Status unavailable",
      detail: "Aylo could not safely interpret the current booking status.",
    },
  };
  return content[status];
}
