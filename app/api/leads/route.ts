import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  LeadAccessNotConfiguredError,
  LeadBusinessNotFoundError,
  LeadUnauthorizedError,
} from "@/lib/leads/errors";
import { getLeadInboxData } from "@/lib/leads/data";
import { LeadQuerySchema } from "@/types/lead";

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
    const filters = LeadQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const data = await getLeadInboxData(
      filters,
      request.headers.get("authorization"),
    );

    return json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        {
          ok: false,
          code: "INVALID_QUERY",
          error: "Use a valid businessId, status, and no unsupported parameters.",
        },
        400,
      );
    }

    if (error instanceof LeadAccessNotConfiguredError) {
      return json(
        {
          ok: false,
          code: "LEAD_ACCESS_NOT_CONFIGURED",
          error: "Add a strong AYLO_OPERATOR_TOKEN and restart the server.",
        },
        503,
      );
    }

    if (error instanceof LeadUnauthorizedError) {
      return json(
        {
          ok: false,
          code: "LEAD_ACCESS_REQUIRED",
          error: "The operator token is missing or invalid.",
        },
        401,
        { "WWW-Authenticate": 'Bearer realm="Aylo lead inbox"' },
      );
    }

    if (error instanceof LeadBusinessNotFoundError) {
      return json(
        { ok: false, code: "BUSINESS_NOT_FOUND", error: "Business not found." },
        404,
      );
    }

    console.error("Lead inbox load failed", error);
    return json(
      {
        ok: false,
        code: "LEAD_INBOX_LOAD_FAILED",
        error: "Lead inbox could not be loaded.",
      },
      500,
    );
  }
}
