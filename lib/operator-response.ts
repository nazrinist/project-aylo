import "server-only";

import { NextResponse } from "next/server";
import {
  isOperatorAccessConfigured,
  verifyOperatorAuthorization,
} from "@/lib/operator-access";

export function requireOperatorAuthorization(request: Request, realm: string) {
  if (!isOperatorAccessConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "OPERATOR_ACCESS_NOT_CONFIGURED",
        error: "Add a strong AYLO_OPERATOR_TOKEN and restart the server",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (!verifyOperatorAuthorization(request.headers.get("authorization"))) {
    return NextResponse.json(
      {
        ok: false,
        code: "OPERATOR_ACCESS_REQUIRED",
        error: "The operator token is missing or invalid",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store",
          "WWW-Authenticate": `Bearer realm="${realm}"`,
        },
      },
    );
  }

  return null;
}
