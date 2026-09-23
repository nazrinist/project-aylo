import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractIntent } from "@/lib/ai/intent";
import { nextFollowUpQuestion } from "@/lib/intent/follow-up";
import { applySearchPreferences } from "@/lib/preferences/shared";
import {
  PREFERENCES_COOKIE,
  readPreferences,
} from "@/lib/preferences/session";

const BodySchema = z.object({ request: z.string().trim().min(3).max(1000) });

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const extractedIntent = await extractIntent(body.request);
    const { intent, appliedPreferences } = applySearchPreferences(
      extractedIntent,
      readPreferences(req.cookies.get(PREFERENCES_COOKIE)?.value),
    );
    return NextResponse.json({
      ok: true,
      intent,
      followUp: nextFollowUpQuestion(intent),
      appliedPreferences,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
