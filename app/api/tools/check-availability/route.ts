import { NextResponse } from "next/server";
import { executeCheckAvailabilityTool } from "@/lib/tools/check-availability";

export async function POST(request: Request) {
  try {
    const result = await executeCheckAvailabilityTool(await request.json());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
