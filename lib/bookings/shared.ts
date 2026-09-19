import type {
  BookingConfirmation,
  BookingCreateInput,
  BookingOfferClaims,
} from "@/types/booking";
import type { SearchResult } from "@/types/search";

export function bookingClaimsFromResult(
  requestId: string,
  result: SearchResult,
): BookingOfferClaims {
  return {
    requestId,
    availabilityId: result.id,
    businessId: result.businessId,
    serviceId: result.serviceId,
    bookedFor: result.availableTime,
    expectedPrice: result.price,
    expectedCurrency: result.currency.toUpperCase(),
  };
}

export function bookingClaimsFromInput(
  input: BookingCreateInput,
): BookingOfferClaims {
  return {
    requestId: input.requestId,
    availabilityId: input.availabilityId,
    businessId: input.businessId,
    serviceId: input.serviceId,
    bookedFor: input.bookedFor,
    expectedPrice: input.expectedPrice,
    expectedCurrency: input.expectedCurrency,
  };
}

export function bookingInputFromConfirmation(
  confirmation: BookingConfirmation,
): BookingCreateInput | null {
  if (!confirmation.requestId || !confirmation.bookingToken) return null;

  return {
    requestId: confirmation.requestId,
    availabilityId: confirmation.availabilityId,
    businessId: confirmation.businessId,
    serviceId: confirmation.serviceId,
    bookedFor: confirmation.bookedFor,
    expectedPrice: confirmation.price,
    expectedCurrency: confirmation.currency.toUpperCase(),
    bookingToken: confirmation.bookingToken,
    userConfirmed: true,
  };
}
