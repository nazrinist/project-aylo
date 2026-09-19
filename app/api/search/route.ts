import { NextResponse } from "next/server";
import { IntentSchema } from "@/types/intent";
import { searchProviders } from "@/lib/search/providers";
import {
  createSearchRequest,
  finishSearchRequest,
} from "@/lib/requests/persistence";

export async function POST(request: Request) {
  let savedRequestId: string | null = null;

  try {
    const intent = IntentSchema.parse(await request.json());
    const requestPersistence = await createSearchRequest(intent);
    savedRequestId = requestPersistence.requestId;
    const search = await searchProviders(intent);
    if (savedRequestId) {
      await finishSearchRequest(savedRequestId, "searched", search.results.length);
    }
    return NextResponse.json({ ok: true, requestPersistence, ...search });
  } catch (error) {
    if (savedRequestId) await finishSearchRequest(savedRequestId, "failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
