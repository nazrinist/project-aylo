import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAvailabilityManagementData } from "@/lib/availability-management/data";
import {
  AvailabilityAccessNotConfiguredError,
  AvailabilityActionsUnavailableError,
  AvailabilityBusinessNotFoundError,
  AvailabilityMutationWriteError,
  AvailabilityServiceNotFoundError,
  AvailabilityUnauthorizedError,
} from "@/lib/availability-management/errors";
import { mutateAvailability } from "@/lib/availability-management/mutation";
import { AvailabilityManagementQuerySchema } from "@/types/availability";

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

function accessError(error: unknown) {
  if (error instanceof AvailabilityAccessNotConfiguredError) {
    return json(
      {
        ok: false,
        code: "AVAILABILITY_ACCESS_NOT_CONFIGURED",
        error: "Add a strong AYLO_OPERATOR_TOKEN and restart the server.",
      },
      503,
    );
  }

  if (error instanceof AvailabilityUnauthorizedError) {
    return json(
      {
        ok: false,
        code: "AVAILABILITY_ACCESS_REQUIRED",
        error: "The operator token is missing or invalid.",
      },
      401,
      { "WWW-Authenticate": 'Bearer realm="Aylo availability"' },
    );
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = AvailabilityManagementQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const data = await getAvailabilityManagementData(
      query,
      request.headers.get("authorization"),
    );
    return json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        {
          ok: false,
          code: "AVAILABILITY_QUERY_INVALID",
          error: "Use a valid business, service, and Baku start date.",
        },
        400,
      );
    }

    const denied = accessError(error);
    if (denied) return denied;

    if (
      error instanceof AvailabilityBusinessNotFoundError ||
      error instanceof AvailabilityServiceNotFoundError
    ) {
      return json(
        {
          ok: false,
          code:
            error instanceof AvailabilityBusinessNotFoundError
              ? "BUSINESS_NOT_FOUND"
              : "SERVICE_NOT_FOUND",
          error: error.message,
        },
        404,
      );
    }

    console.error("Availability management load failed", error);
    return json(
      {
        ok: false,
        code: "AVAILABILITY_LOAD_FAILED",
        error: "The availability schedule could not be loaded.",
      },
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const result = await mutateAvailability(
      await request.json(),
      request.headers.get("authorization"),
    );
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return json(
        {
          ok: false,
          code: "AVAILABILITY_MUTATION_INPUT_INVALID",
          error: "Use a complete, explicitly confirmed availability action.",
        },
        400,
      );
    }

    const denied = accessError(error);
    if (denied) return denied;

    if (error instanceof AvailabilityActionsUnavailableError) {
      return json(
        {
          ok: false,
          code: "AVAILABILITY_ACTIONS_UNAVAILABLE",
          error: "Live actions require the server-side Supabase secret key.",
        },
        503,
      );
    }

    if (error instanceof AvailabilityMutationWriteError) {
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
      "Availability mutation failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json(
      {
        ok: false,
        code: "AVAILABILITY_MUTATION_FAILED",
        error: "The availability change could not be saved. Refresh and try again.",
      },
      500,
    );
  }
}
