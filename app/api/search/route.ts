import { NextResponse } from "next/server";
import { IntentSchema } from "@/types/intent";
import { searchProviders } from "@/lib/search/providers";

export async function POST(request: Request) {
  try {
    const intent = IntentSchema.parse(await request.json());
    const search = await searchProviders(intent);
    return NextResponse.json({ ok: true, ...search });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
