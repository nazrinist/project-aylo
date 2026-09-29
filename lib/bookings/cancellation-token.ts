import "server-only";

import {
  openConsumerBookingCancellationToken,
  sealConsumerBookingCancellationToken,
} from "@/lib/bookings/cancellation-token-core";
import { getRequestHistorySecret } from "@/lib/history/session";

export function createConsumerBookingCancellationToken(bookingId: string) {
  const secret = getRequestHistorySecret();
  if (!secret) throw new Error("Consumer booking cancellation is not configured");
  return sealConsumerBookingCancellationToken(bookingId, secret);
}

export function verifyConsumerBookingCancellationToken(token: string) {
  const secret = getRequestHistorySecret();
  return secret ? openConsumerBookingCancellationToken(token, secret) : null;
}
