import { type NextRequest, NextResponse } from "next/server";
import { executeSearchProvidersTool } from "@/lib/tools/search-providers";
import { requireBetaAccess } from "@/lib/beta/response";
import { requirePublicBetaRateLimit } from "@/lib/beta/rate-limit";

export async function POST(request: NextRequest) {
  const betaAccessError = requireBetaAccess(request);
  if (betaAccessError) return betaAccessError;
  const betaRateLimitError = await requirePublicBetaRateLimit(
    request,
    "search_providers",
  );
  if (betaRateLimitError) return betaRateLimitError;
  try {
    const result = await executeSearchProvidersTool(await request.json());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
