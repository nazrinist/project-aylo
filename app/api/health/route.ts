import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TableCount = {
  count: number;
  error: string | null;
};

async function countRows(
  table: "businesses" | "services" | "availability",
  onlyAvailable = false,
): Promise<TableCount> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (onlyAvailable) query = query.eq("status", "available");
  const { count, error } = await query;
  return { count: count ?? 0, error: error?.message ?? null };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({
      status: "demo",
      database: "not_configured",
      counts: null,
    });
  }

  try {
    const [businesses, services, slots] = await Promise.all([
      countRows("businesses"),
      countRows("services"),
      countRows("availability", true),
    ]);
    const firstError = businesses.error || services.error || slots.error;

    if (firstError) {
      return Response.json(
        {
          status: "error",
          database: "reachable_but_not_ready",
          message: firstError,
          counts: null,
        },
        { status: 503 },
      );
    }

    return Response.json({
      status: "live",
      database: "connected",
      counts: {
        businesses: businesses.count,
        services: services.count,
        availableSlots: slots.count,
      },
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        database: "unreachable",
        message: error instanceof Error ? error.message : "Database check failed",
        counts: null,
      },
      { status: 503 },
    );
  }
}
