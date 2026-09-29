import "server-only";

import { getRequestHistorySecret } from "@/lib/history/session";
import { openRescheduleToken, sealRescheduleToken, type ReschedulePayload } from "@/lib/bookings/reschedule-token-core";

export function createRescheduleToken(payload: ReschedulePayload) {
  const secret = getRequestHistorySecret();
  if (!secret) throw new Error("Reschedule encryption unavailable");
  return sealRescheduleToken(payload, secret);
}

export function verifyRescheduleToken(token: string) {
  const secret = getRequestHistorySecret();
  return secret ? openRescheduleToken(token, secret) : null;
}
