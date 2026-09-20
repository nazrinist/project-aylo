import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  decideLead,
  LeadActionsUnavailableError,
  LeadActionTokenInvalidError,
} from "@/lib/leads/decision";
import { LeadDecisionWriteError } from "@/lib/leads/decision-errors";
import {
  LeadAccessNotConfiguredError,
  LeadUnauthorizedError,
} from "@/lib/leads/errors";
import { LeadDecisionInputSchema } from "@/types/lead";

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

export async function POST(request: Request) {
  try {
    const input = LeadDecisionInputSchema.parse(await request.json());
    const result = await decideLead(
      input,
      request.headers.get("authorization"),
    );
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return json(
        {
          ok: false,
          code: "LEAD_DECISION_INPUT_INVALID",
          error: "Choose accept or reject and explicitly confirm the decision.",
        },
        400,
      );
    }

    if (error instanceof LeadActionsUnavailableError) {
      return json(
        {
          ok: false,
          code: "LEAD_ACTIONS_UNAVAILABLE",
          error: "Live lead actions require the server-side Supabase secret key.",
        },
        503,
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
        { "WWW-Authenticate": 'Bearer realm="Aylo lead decisions"' },
      );
    }

    if (error instanceof LeadActionTokenInvalidError) {
      return json(
        {
          ok: false,
          code: "LEAD_ACTION_TOKEN_INVALID",
          error: "This lead action expired or changed. Refresh the inbox.",
        },
        403,
      );
    }

    if (error instanceof LeadDecisionWriteError) {
      return json(
        {
          ok: false,
          code: error.details.code,
          error: error.details.message,
        },
        error.details.status,
      );
    }

    console.error(
      "Lead decision failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json(
      {
        ok: false,
        code: "LEAD_DECISION_FAILED",
        error: "The lead decision could not be saved. Try again.",
      },
      500,
    );
  }
}
