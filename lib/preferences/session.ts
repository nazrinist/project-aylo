import "server-only";

import {
  openPreferencesToken,
  PREFERENCES_TOKEN_TTL_MS,
  sealPreferencesToken,
} from "@/lib/preferences/token-core";
import {
  EMPTY_SEARCH_PREFERENCES,
  type SearchPreferences,
} from "@/types/preferences";

export const PREFERENCES_COOKIE = "aylo_search_preferences";

export function getPreferencesSecret() {
  const candidates = [
    process.env.PREFERENCES_SECRET,
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

export function readPreferences(token: string | undefined): SearchPreferences {
  const secret = getPreferencesSecret();
  if (!secret || !token) return EMPTY_SEARCH_PREFERENCES;
  return openPreferencesToken(token, secret)?.preferences ?? EMPTY_SEARCH_PREFERENCES;
}

export function createPreferencesToken(preferences: SearchPreferences) {
  const secret = getPreferencesSecret();
  return secret ? sealPreferencesToken(preferences, secret) : null;
}

export function preferencesCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREFERENCES_TOKEN_TTL_MS / 1000,
    priority: "high" as const,
  };
}
