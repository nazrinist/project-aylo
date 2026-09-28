import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { consumeBetaRateLimit } from "@/lib/beta/data";
import {
  PUBLIC_BETA_RATE_LIMITS,
  type PublicBetaRateLimitAction,
} from "@/lib/beta/rate-limit-shared";
import {
  BETA_SESSION_COOKIE,
  getBetaAccessState,
} from "@/lib/beta/session";
import { isSupabaseAdminConfigured } from "@/lib/supabase/server";

function unavailable(code: string, error: string, status = 503) {
  return NextResponse.json(
    { ok: false, code, error },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    },
  );
}

export async function requirePublicBetaRateLimit(
  request: NextRequest,
  action: PublicBetaRateLimitAction,
) {
  const state = getBetaAccessState(
    request.cookies.get(BETA_SESSION_COOKIE)?.value,
  );
  if (state.mode !== "public") return null;
  if (!state.configured || !state.claims) {
    return unavailable(
      "PUBLIC_BETA_SESSION_REQUIRED",
      "Refresh Aylo to start a private public-beta session, then try again.",
      428,
    );
  }
  if (!isSupabaseAdminConfigured()) {
    return unavailable(
      "PUBLIC_BETA_RATE_LIMIT_UNAVAILABLE",
      "Public beta request protection is not configured.",
    );
  }

  try {
    const policy = PUBLIC_BETA_RATE_LIMITS[action];
    const result = await consumeBetaRateLimit(
      state.claims,
      action,
      policy.limit,
      policy.windowSeconds,
    );
    if (result.allowed) return null;

    return NextResponse.json(
      {
        ok: false,
        code: "PUBLIC_BETA_RATE_LIMITED",
        error: "Too many requests from this beta session. Please try again shortly.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
          "X-RateLimit-Limit": String(policy.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          Vary: "Cookie",
        },
      },
    );
  } catch {
    console.error("Public beta rate-limit check failed");
    return unavailable(
      "PUBLIC_BETA_RATE_LIMIT_UNAVAILABLE",
      "Public beta request protection is temporarily unavailable.",
    );
  }
}
