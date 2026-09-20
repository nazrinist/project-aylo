import "server-only";

import {
  openLeadActionToken,
  sealLeadActionToken,
} from "@/lib/leads/action-token-core";
import { getLeadAccessSecret } from "@/lib/leads/access";

export function createLeadActionToken(
  bookingId: string,
  businessId: string,
) {
  const secret = getLeadAccessSecret();
  if (!secret) throw new Error("Lead action access is not configured");
  return sealLeadActionToken({ bookingId, businessId }, secret);
}

export function verifyLeadActionToken(token: string) {
  const secret = getLeadAccessSecret();
  return secret ? openLeadActionToken(token, secret) : null;
}
