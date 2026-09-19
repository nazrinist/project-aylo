import { createHmac, timingSafeEqual } from "node:crypto";
import type { BookingOfferClaims } from "@/types/booking";

function canonicalClaims(claims: BookingOfferClaims) {
  return JSON.stringify([
    "aylo-booking-v1",
    claims.requestId.toLowerCase(),
    claims.availabilityId.toLowerCase(),
    claims.businessId.toLowerCase(),
    claims.serviceId.toLowerCase(),
    new Date(claims.bookedFor).toISOString(),
    claims.expectedPrice.toFixed(2),
    claims.expectedCurrency.toUpperCase(),
  ]);
}

export function signBookingOffer(
  claims: BookingOfferClaims,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(canonicalClaims(claims))
    .digest("hex");
}

export function verifyBookingOfferToken(
  claims: BookingOfferClaims,
  token: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(signBookingOffer(claims, secret), "hex");
  const received = Buffer.from(token, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function getBookingSigningSecret() {
  return (
    process.env.BOOKING_SIGNING_SECRET
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || null
  );
}
