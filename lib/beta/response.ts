import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import {
  BETA_SESSION_COOKIE,
  getBetaAccessState,
} from "@/lib/beta/session";

export function requireBetaAccess(request: NextRequest) {
  const state = getBetaAccessState(
    request.cookies.get(BETA_SESSION_COOKIE)?.value,
  );
  if (state.authenticated) return null;

  return NextResponse.json(
    {
      ok: false,
      code: state.configured ? "BETA_ACCESS_REQUIRED" : "BETA_NOT_CONFIGURED",
      error: state.configured
        ? "Closed beta access is required."
        : state.mode === "public"
          ? "Public beta access is not configured."
          : "Closed beta access is not configured.",
    },
    {
      status: state.configured ? 401 : 503,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    },
  );
}
