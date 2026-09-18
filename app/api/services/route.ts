import { NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { ServiceInputSchema } from "@/types/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BusinessFilterSchema = z.string().uuid().optional();

type ServiceRow = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | string;
  currency: string;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  businesses: { id: string; name: string } | null;
};

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const businessId = BusinessFilterSchema.parse(
      new URL(request.url).searchParams.get("businessId") ?? undefined,
    );
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("services")
      .select(
        "id,business_id,name,description,price,currency,duration_minutes,active,created_at,businesses!inner(id,name)",
      )
      .order("name");

    if (businessId) query = query.eq("business_id", businessId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const services = ((data ?? []) as unknown as ServiceRow[]).map((service) => ({
      id: service.id,
      business_id: service.business_id,
      business_name: service.businesses?.name ?? "Unknown business",
      name: service.name,
      description: service.description,
      price: Number(service.price),
      currency: service.currency,
      duration_minutes: service.duration_minutes,
      active: service.active,
      created_at: service.created_at,
    }));

    return NextResponse.json({ ok: true, services });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Load failed" },
      { status: 400 },
    );
  }
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
    const input = ServiceInputSchema.parse(await request.json());
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("services")
      .insert(input)
      .select("id,business_id,name,description,price,currency,duration_minutes,active,created_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, service: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Create failed" },
      { status: 400 },
    );
  }
}
