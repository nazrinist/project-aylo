import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { registerBetaParticipant } from "@/lib/beta/data";
import {
  BETA_SESSION_COOKIE,
  betaSessionCookieOptions,
  createBetaSession,
  createPublicBetaSession,
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
  const currentToken = request.cookies.get(BETA_SESSION_COOKIE)?.value;
  let state = getBetaAccessState(currentToken);
  let tracked = false;
  let publicSession = null;
  if (state.mode === "public" && state.configured && !state.claims) {
    publicSession = createPublicBetaSession(currentToken);
    if (publicSession) {
      state = getBetaAccessState(publicSession.token);
      try {
        tracked = await registerBetaParticipant(publicSession.claims);
      } catch {
        console.error("Public beta participant tracking failed");
      }
    }
  }
  const response = json({
    ok: true,
    mode: state.mode,
    configured: state.configured,
    authenticated: state.authenticated,
    participantReady: Boolean(state.claims),
    expiresAt: state.claims?.expiresAt ?? null,
    tracked,
  });
  if (publicSession) {
    response.cookies.set({
      name: BETA_SESSION_COOKIE,
      value: publicSession.token,
      ...betaSessionCookieOptions(),
    });
  }
  return response;
}

export async function POST(request: NextRequest) {
  try {
    if (getBetaMode() === "open") {
      return json({
        ok: true,
        mode: "open",
        configured: true,
        authenticated: true,
        tracked: false,
      });
    }
    const currentToken = request.cookies.get(BETA_SESSION_COOKIE)?.value;
    if (getBetaMode() === "public") {
      const session = createPublicBetaSession(currentToken);
      if (!session) {
        return json({
          ok: false,
          code: "BETA_NOT_CONFIGURED",
          error: "Public beta access is not configured.",
        }, 503);
      }
      let tracked = false;
      try {
        tracked = await registerBetaParticipant(session.claims);
      } catch {
        console.error("Public beta participant tracking failed");
      }
      const response = json({
        ok: true,
        mode: "public",
        configured: true,
        authenticated: true,
        participantReady: true,
        tracked,
      });
      response.cookies.set({
        name: BETA_SESSION_COOKIE,
        value: session.token,
        ...betaSessionCookieOptions(),
      });
      return response;
    }
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
      participantReady: true,
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
