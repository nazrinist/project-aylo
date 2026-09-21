import { NextResponse } from "next/server";
import { availabilityWriteError, validateAvailabilitySlot } from "@/lib/availability";
import {
  isOperatorAccessConfigured,
  verifyOperatorAuthorization,
} from "@/lib/operator-access";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  AvailabilityInputSchema,
  AvailabilityQuerySchema,
} from "@/types/availability";

export const dynamic = "force-dynamic";

type AvailabilityRow = {
  id: string;
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: "available";
  created_at: string;
  businesses: { id: string; name: string } | null;
  services: { id: string; name: string } | null;
};

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

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const url = new URL(request.url);
    const filters = AvailabilityQuerySchema.parse({
      businessId: url.searchParams.get("businessId") ?? undefined,
      serviceId: url.searchParams.get("serviceId") ?? undefined,
      date: url.searchParams.get("date"),
    });
    const dayStart = new Date(`${filters.date}T00:00:00+04:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("availability")
      .select(
        "id,business_id,service_id,start_time,end_time,status,created_at,businesses!inner(id,name),services!inner(id,name)",
      )
      .eq("status", "available")
      .gte("start_time", dayStart.toISOString())
      .lt("start_time", dayEnd.toISOString())
      .order("start_time");

    if (filters.businessId) query = query.eq("business_id", filters.businessId);
    if (filters.serviceId) query = query.eq("service_id", filters.serviceId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const availability = ((data ?? []) as unknown as AvailabilityRow[]).map((slot) => ({
      id: slot.id,
      business_id: slot.business_id,
      business_name: slot.businesses?.name ?? "Unknown business",
      service_id: slot.service_id,
      service_name: slot.services?.name ?? "Unknown service",
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: slot.status,
      created_at: slot.created_at,
    }));

    return NextResponse.json({ ok: true, availability });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Load failed" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) return missingAdminKey();
  if (!isOperatorAccessConfigured()) return missingOperatorAccess();
  if (!verifyOperatorAuthorization(request.headers.get("authorization"))) {
    return unauthorized();
  }

  try {
    const input = AvailabilityInputSchema.parse(await request.json());
    if (new Date(input.start_time).getTime() <= Date.now()) {
      throw new Error("Past slots cannot be created");
    }
    const supabase = getSupabaseAdminClient();
    await validateAvailabilitySlot(supabase, input);

    const { data, error } = await supabase
      .from("availability")
      .insert(input)
      .select("id,business_id,service_id,start_time,end_time,status,created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, availability: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: availabilityWriteError(error, "Create failed") },
      { status: 400 },
    );
  }
}
