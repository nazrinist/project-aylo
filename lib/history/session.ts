import "server-only";

import {
  openRequestHistoryToken,
  prependRequestHistoryId,
  REQUEST_HISTORY_TOKEN_TTL_MS,
  sealRequestHistoryToken,
} from "@/lib/history/token-core";

export const REQUEST_HISTORY_COOKIE = "aylo_request_history";

export function getRequestHistorySecret() {
  const candidates = [
    process.env.REQUEST_HISTORY_SECRET,
    process.env.BOOKING_SIGNING_SECRET,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];
  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length >= 32,
  )?.trim() ?? null;
}

export function readRequestHistoryIds(token: string | undefined) {
  const secret = getRequestHistorySecret();
  if (!secret || !token) return [];
  return openRequestHistoryToken(token, secret)?.requestIds ?? [];
}

export function rollRequestHistoryToken(currentToken: string | undefined, requestId: string) {
  const secret = getRequestHistorySecret();
  if (!secret) return null;
  const currentIds = currentToken
    ? openRequestHistoryToken(currentToken, secret)?.requestIds ?? []
    : [];
  return sealRequestHistoryToken(prependRequestHistoryId(currentIds, requestId), secret);
}

export function requestHistoryCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REQUEST_HISTORY_TOKEN_TTL_MS / 1000,
    priority: "high" as const,
  };
}
