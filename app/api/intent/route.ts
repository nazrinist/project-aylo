import { NextResponse } from "next/server";
import { z } from "zod";
import { extractIntent } from "@/lib/ai/intent";
import { nextFollowUpQuestion } from "@/lib/intent/follow-up";

const BodySchema = z.object({ request: z.string().trim().min(3).max(1000) });

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const intent = await extractIntent(body.request);
    return NextResponse.json({
      ok: true,
      intent,
      followUp: nextFollowUpQuestion(intent),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
