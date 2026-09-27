import { type NextRequest, NextResponse } from "next/server";
import { SearchEdgeCaseError } from "@/lib/search/edge-cases";
import { executeCheckAvailabilityTool } from "@/lib/tools/check-availability";
import { requireBetaAccess } from "@/lib/beta/response";

export async function POST(request: NextRequest) {
  const betaAccessError = requireBetaAccess(request);
  if (betaAccessError) return betaAccessError;
  try {
    const result = await executeCheckAvailabilityTool(await request.json());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const edgeCaseError = error instanceof SearchEdgeCaseError ? error : null;
    return NextResponse.json(
      {
        ok: false,
        code: edgeCaseError?.code ?? "AVAILABILITY_REQUEST_INVALID",
        error: edgeCaseError?.message ?? "The availability request is invalid.",
      },
      { status: edgeCaseError?.status ?? 400 },
    );
  }
}
