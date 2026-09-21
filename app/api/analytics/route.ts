import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAnalyticsData } from "@/lib/analytics/data";
import {
  AnalyticsAccessNotConfiguredError,
  AnalyticsBusinessNotFoundError,
  AnalyticsPrerequisiteMissingError,
  AnalyticsUnauthorizedError,
} from "@/lib/analytics/errors";
import { AnalyticsQuerySchema } from "@/types/analytics";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...headers,
    },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = AnalyticsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const data = await getAnalyticsData(
      query,
      request.headers.get("authorization"),
    );

    return json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        {
          ok: false,
          code: "ANALYTICS_QUERY_INVALID",
          error: "Use a valid businessId, analytics range, and no unsupported parameters.",
        },
        400,
      );
    }

    if (error instanceof AnalyticsAccessNotConfiguredError) {
      return json(
        {
          ok: false,
          code: "ANALYTICS_ACCESS_NOT_CONFIGURED",
          error: "Add a strong AYLO_OPERATOR_TOKEN and restart the server.",
        },
        503,
      );
    }

    if (error instanceof AnalyticsUnauthorizedError) {
      return json(
        {
          ok: false,
          code: "ANALYTICS_ACCESS_REQUIRED",
          error: "The operator token is missing or invalid.",
        },
        401,
        { "WWW-Authenticate": 'Bearer realm="Aylo analytics"' },
      );
    }

    if (error instanceof AnalyticsBusinessNotFoundError) {
      return json(
        { ok: false, code: "BUSINESS_NOT_FOUND", error: "Business not found." },
        404,
      );
    }

    if (error instanceof AnalyticsPrerequisiteMissingError) {
      return json(
        {
          ok: false,
          code: "ANALYTICS_PREREQUISITE_MISSING",
          error: "Run the Day 19 Supabase migration and restart the server.",
        },
        503,
      );
    }

    console.error("Analytics load failed", error);
    return json(
      {
        ok: false,
        code: "ANALYTICS_LOAD_FAILED",
        error: "Analytics could not be loaded.",
      },
      500,
    );
  }
}
