import { type NextRequest, NextResponse } from "next/server";
import {
  BETA_SESSION_COOKIE,
  betaSessionCookieOptions,
  createPublicBetaSession,
  getBetaAccessState,
} from "@/lib/beta/session";

const PUBLIC_API_PATHS = new Set([
  "/api/beta/access",
  "/api/health",
]);
const PUBLIC_PAGE_PATHS = new Set(["/beta", "/privacy", "/robots.txt"]);

export function proxy(request: NextRequest) {
  if (
    PUBLIC_API_PATHS.has(request.nextUrl.pathname) ||
    PUBLIC_PAGE_PATHS.has(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  const state = getBetaAccessState(
    request.cookies.get(BETA_SESSION_COOKIE)?.value,
  );
  if (state.mode === "public" && state.configured && !state.claims) {
    const session = createPublicBetaSession();
    if (session) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.append("Vary", "Cookie");
      response.cookies.set({
        name: BETA_SESSION_COOKIE,
        value: session.token,
        ...betaSessionCookieOptions(),
      });
      return response;
    }
  }
  if (state.authenticated) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
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

  const betaUrl = request.nextUrl.clone();
  betaUrl.pathname = "/beta";
  betaUrl.search = "";
  return NextResponse.redirect(betaUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
