import { NextResponse } from "next/server";
import { availabilityWriteError, validateAvailabilitySlot } from "@/lib/availability";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured()) return missingAdminKey();

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
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured()) return missingAdminKey();

  try {
    const { id: rawId } = await context.params;
    const id = AvailabilityIdSchema.parse(rawId);
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("availability").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: availabilityWriteError(error, "Delete failed") },
      { status: 400 },
    );
  }
}
