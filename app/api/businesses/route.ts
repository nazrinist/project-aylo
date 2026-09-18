import { NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { BusinessInputSchema } from "@/types/business";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,category,address,latitude,longitude,rating,verified,created_at")
    .order("name");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, businesses: data ?? [] });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "ADMIN_KEY_MISSING",
        error: "Add SUPABASE_SECRET_KEY to .env.local and restart the server",
      },
      { status: 503 },
    );
  }

  try {
    const input = BusinessInputSchema.parse(await request.json());
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("businesses")
      .insert(input)
      .select("id,name,category,address,latitude,longitude,rating,verified,created_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, business: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Create failed" },
      { status: 400 },
    );
  }
}
