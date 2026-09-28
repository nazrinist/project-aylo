export const PUBLIC_BETA_RATE_LIMITS = {
  intent: { limit: 20, windowSeconds: 10 * 60 },
  search: { limit: 20, windowSeconds: 10 * 60 },
  booking: { limit: 5, windowSeconds: 10 * 60 },
  feedback: { limit: 5, windowSeconds: 60 * 60 },
  search_providers: { limit: 30, windowSeconds: 10 * 60 },
  check_availability: { limit: 30, windowSeconds: 10 * 60 },
} as const;

export type PublicBetaRateLimitAction = keyof typeof PUBLIC_BETA_RATE_LIMITS;
