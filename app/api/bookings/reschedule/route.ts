import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireBetaAccess } from "@/lib/beta/response";
import { requirePublicBetaRateLimit } from "@/lib/beta/rate-limit";
import { REQUEST_HISTORY_COOKIE } from "@/lib/history/session";
import { rescheduleConsumerBooking, RescheduleError } from "@/lib/bookings/reschedule";
import { ConsumerRescheduleInputSchema } from "@/types/booking";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function POST(request: NextRequest) {
  const betaAccessError = requireBetaAccess(request);
  if (betaAccessError) return betaAccessError;
  const limit = await requirePublicBetaRateLimit(request, "booking");
  if (limit) return limit;
  try {
    const input = ConsumerRescheduleInputSchema.parse(await request.json());
    const data = await rescheduleConsumerBooking(input.optionToken, request.cookies.get(REQUEST_HISTORY_COOKIE)?.value);
    return json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError)
      return json({ ok: false, code: "RESCHEDULE_INPUT_INVALID", error: "Explicitly confirm a valid new time." }, 400);
    if (error instanceof RescheduleError)
      return json({ ok: false, code: error.code, error: error.message }, error.status);
    console.error("Booking reschedule failed");
    return json({ ok: false, code: "RESCHEDULE_FAILED", error: "The booking could not be rescheduled." }, 500);
  }
}
