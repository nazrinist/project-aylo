import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireBetaAccess } from "@/lib/beta/response";
import { requirePublicBetaRateLimit } from "@/lib/beta/rate-limit";
import { REQUEST_HISTORY_COOKIE } from "@/lib/history/session";
import { getRescheduleOptions, RescheduleError } from "@/lib/bookings/reschedule";
import { ConsumerRescheduleOptionsInputSchema } from "@/types/booking";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function POST(request: NextRequest) {
  const betaAccessError = requireBetaAccess(request);
  if (betaAccessError) return betaAccessError;
  const limit = await requirePublicBetaRateLimit(request, "check_availability");
  if (limit) return limit;
  try {
    const input = ConsumerRescheduleOptionsInputSchema.parse(await request.json());
    const data = await getRescheduleOptions(input.actionToken, request.cookies.get(REQUEST_HISTORY_COOKIE)?.value);
    return json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError)
      return json({ ok: false, code: "RESCHEDULE_INPUT_INVALID", error: "Choose a valid booking." }, 400);
    if (error instanceof RescheduleError)
      return json({ ok: false, code: error.code, error: error.message }, error.status);
    console.error("Booking reschedule options failed");
    return json({ ok: false, code: "RESCHEDULE_FAILED", error: "Could not load available times." }, 500);
  }
}
