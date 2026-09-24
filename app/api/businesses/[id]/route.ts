import { NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";
import { BusinessIdSchema, BusinessUpdateSchema } from "@/types/business";
import { requireOperatorAuthorization } from "@/lib/operator-response";

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
  const accessError = requireOperatorAuthorization(request, "Aylo business management");
  if (accessError) return accessError;

  try {
    const { id: rawId } = await context.params;
    const id = BusinessIdSchema.parse(rawId);
    const input = BusinessUpdateSchema.parse(await request.json());
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("businesses")
      .update(input)
      .eq("id", id)
      .select("id,name,category,address,latitude,longitude,rating,verified,created_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, business: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured()) return missingAdminKey();
  const accessError = requireOperatorAuthorization(request, "Aylo business management");
  if (accessError) return accessError;

  try {
    const { id: rawId } = await context.params;
    const id = BusinessIdSchema.parse(rawId);
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("businesses").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 },
    );
  }
}
