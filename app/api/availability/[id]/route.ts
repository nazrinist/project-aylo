import { NextResponse } from "next/server";
import { availabilityWriteError, validateAvailabilitySlot } from "@/lib/availability";
import {
  isOperatorAccessConfigured,
  verifyOperatorAuthorization,
} from "@/lib/operator-access";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";
import {
  AvailabilityIdSchema,
  AvailabilityInputSchema,
  AvailabilityUpdateSchema,
} from "@/types/availability";

function missingAdminKey() {
  return NextResponse.json(
    {
      ok: false,
      code: "ADMIN_KEY_MISSING",
      error: "Add SUPABASE_SECRET_KEY to .env.local and restart the server",
    },
    { status: 503 },
  );
}

function missingOperatorAccess() {
  return NextResponse.json(
    {
      ok: false,
      code: "AVAILABILITY_ACCESS_NOT_CONFIGURED",
      error: "Add a strong AYLO_OPERATOR_TOKEN and restart the server",
    },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      code: "AVAILABILITY_ACCESS_REQUIRED",
      error: "The operator token is missing or invalid",
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "private, no-store",
        "WWW-Authenticate": 'Bearer realm="Aylo availability"',
      },
    },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured()) return missingAdminKey();
  if (!isOperatorAccessConfigured()) return missingOperatorAccess();
  if (!verifyOperatorAuthorization(request.headers.get("authorization"))) {
    return unauthorized();
  }

  try {
    const { id: rawId } = await context.params;
    const id = AvailabilityIdSchema.parse(rawId);
    const changes = AvailabilityUpdateSchema.parse(await request.json());
    const supabase = getSupabaseAdminClient();
    const { data: current, error: currentError } = await supabase
      .from("availability")
      .select("business_id,service_id,start_time,end_time,status")
      .eq("id", id)
      .single();

    if (currentError || !current) throw new Error("Availability slot was not found");
    const input = AvailabilityInputSchema.parse({ ...current, ...changes });
    if (new Date(input.start_time).getTime() <= Date.now()) {
      throw new Error("Past slots cannot be updated");
    }
    await validateAvailabilitySlot(supabase, input, id);

    const { data, error } = await supabase
      .from("availability")
      .update(input)
      .eq("id", id)
      .select("id,business_id,service_id,start_time,end_time,status,created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, availability: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: availabilityWriteError(error, "Update failed") },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured()) return missingAdminKey();
  if (!isOperatorAccessConfigured()) return missingOperatorAccess();
  if (!verifyOperatorAuthorization(request.headers.get("authorization"))) {
    return unauthorized();
  }

  try {
    const { id: rawId } = await context.params;
    const id = AvailabilityIdSchema.parse(rawId);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("availability")
      .delete()
      .eq("id", id)
      .in("status", ["available", "blocked"])
      .gt("start_time", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Only future unreserved slots can be deleted");
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: availabilityWriteError(error, "Delete failed") },
      { status: 400 },
    );
  }
}
