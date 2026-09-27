import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { registerBetaParticipant } from "@/lib/beta/data";
import {
  BETA_SESSION_COOKIE,
  betaSessionCookieOptions,
  createBetaSession,
  getBetaAccessState,
  getBetaMode,
} from "@/lib/beta/session";
import { BetaAccessInputSchema } from "@/types/beta";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function GET(request: NextRequest) {
  const state = getBetaAccessState(
    request.cookies.get(BETA_SESSION_COOKIE)?.value,
  );
  return json({
    ok: true,
    mode: state.mode,
    configured: state.configured,
    authenticated: state.authenticated,
    expiresAt: state.claims?.expiresAt ?? null,
  });
}

export async function POST(request: NextRequest) {
  try {
    if (getBetaMode() !== "closed") {
      return json({
        ok: true,
        mode: "open",
        configured: true,
        authenticated: true,
        tracked: false,
      });
    }
    const currentToken = request.cookies.get(BETA_SESSION_COOKIE)?.value;
    const input = BetaAccessInputSchema.parse(await request.json());
    const session = createBetaSession(input.code, currentToken);
    if (!session) {
      const state = getBetaAccessState(currentToken);
      return json(
        {
          ok: false,
          code: state.configured ? "BETA_CODE_INVALID" : "BETA_NOT_CONFIGURED",
          error: state.configured
            ? "That invite code is not valid."
            : "Closed beta access is not configured.",
        },
        state.configured ? 401 : 503,
      );
    }

    let tracked = false;
    try {
      tracked = await registerBetaParticipant(session.claims);
    } catch {
      console.error("Beta participant tracking failed");
    }

    const response = json({
      ok: true,
      mode: "closed",
      configured: true,
      authenticated: true,
      tracked,
    });
    response.cookies.set({
      name: BETA_SESSION_COOKIE,
      value: session.token,
      ...betaSessionCookieOptions(),
    });
    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json({
        ok: false,
        code: "BETA_CODE_INVALID",
        error: "Enter a valid invite code.",
      }, 400);
    }
    console.error("Beta access failed");
    return json({
      ok: false,
      code: "BETA_ACCESS_FAILED",
      error: "Beta access could not be started.",
    }, 500);
  }
}

export async function DELETE() {
  const response = json({ ok: true });
  response.cookies.set({
    name: BETA_SESSION_COOKIE,
    value: "",
    ...betaSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
