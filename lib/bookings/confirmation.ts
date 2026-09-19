import type { BookingConfirmation, BookingDraft } from "@/types/booking";
import type { SearchResult } from "@/types/search";

export function createBookingDraft(
  result: SearchResult,
  requestId: string | null,
): BookingDraft {
  return {
    requestId,
    availabilityId: result.id,
    businessId: result.businessId,
    businessName: result.businessName,
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    address: result.address,
    bookedFor: result.availableTime,
    durationMinutes: result.durationMinutes,
    price: result.price,
    currency: result.currency,
  };
}

export function confirmBookingDraft(
  draft: BookingDraft,
  confirmedAt: string,
): BookingConfirmation {
  if (!Number.isFinite(Date.parse(confirmedAt))) {
    throw new Error("A valid confirmation timestamp is required");
  }

  return {
    ...draft,
    userConfirmed: true,
    confirmedAt,
  };
}
