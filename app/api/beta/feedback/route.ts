import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { saveBetaFeedback } from "@/lib/beta/data";
import {
  BETA_SESSION_COOKIE,
  getBetaAccessState,
} from "@/lib/beta/session";
import { requireBetaAccess } from "@/lib/beta/response";
import { requirePublicBetaRateLimit } from "@/lib/beta/rate-limit";
import { isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { BetaFeedbackInputSchema } from "@/types/beta";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function POST(request: NextRequest) {
  const accessError = requireBetaAccess(request);
  if (accessError) return accessError;
  const rateLimitError = await requirePublicBetaRateLimit(request, "feedback");
  if (rateLimitError) return rateLimitError;
  const state = getBetaAccessState(
    request.cookies.get(BETA_SESSION_COOKIE)?.value,
  );
  if (state.mode === "open" || !state.claims) {
    return json({
      ok: false,
      code: "BETA_FEEDBACK_SESSION_REQUIRED",
      error: "A private beta session is required before feedback can be saved.",
    }, 409);
  }
  if (!isSupabaseAdminConfigured()) {
    return json({
      ok: false,
      code: "BETA_FEEDBACK_UNAVAILABLE",
      error: "Feedback storage is not configured.",
    }, 503);
  }

  try {
    const input = BetaFeedbackInputSchema.parse(await request.json());
    await saveBetaFeedback(state.claims, input);
    return json({ ok: true }, 201);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json({
        ok: false,
        code: "BETA_FEEDBACK_INVALID",
        error: "Choose an outcome, rate the experience, and keep comments under 1000 characters.",
      }, 400);
    }
    console.error("Beta feedback save failed");
    return json({
      ok: false,
      code: "BETA_FEEDBACK_FAILED",
      error: "Feedback could not be saved. Please try again.",
    }, 500);
  }
}
