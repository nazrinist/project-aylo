import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  DashboardBusinessNotFoundError,
  getDashboardData,
} from "@/lib/dashboard/data";
import { DashboardQuerySchema } from "@/types/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = DashboardQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const data = await getDashboardData(filters.businessId);

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_QUERY",
          error: "Use a valid businessId and no unsupported query parameters.",
        },
        { status: 400 },
      );
    }

    if (error instanceof DashboardBusinessNotFoundError) {
      return NextResponse.json(
        { ok: false, code: "BUSINESS_NOT_FOUND", error: "Business not found." },
        { status: 404 },
      );
    }

    console.error("Dashboard load failed", error);
    return NextResponse.json(
      {
        ok: false,
        code: "DASHBOARD_LOAD_FAILED",
        error: "Dashboard could not be loaded.",
      },
      { status: 500 },
    );
  }
}
