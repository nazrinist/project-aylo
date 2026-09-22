import { type NextRequest, NextResponse } from "next/server";
import { getRequestHistoryData, RequestHistorySecretMissingError } from "@/lib/history/data";
import { REQUEST_HISTORY_COOKIE, requestHistoryCookieOptions } from "@/lib/history/session";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.size > 0) {
      return json({ ok: false, code: "HISTORY_QUERY_INVALID", error: "Request history does not accept query parameters." }, 400);
    }
    const data = await getRequestHistoryData(request.cookies.get(REQUEST_HISTORY_COOKIE)?.value);
    return json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof RequestHistorySecretMissingError) {
      return json({ ok: false, code: "HISTORY_SECRET_MISSING", error: "Add a 32+ character REQUEST_HISTORY_SECRET and restart the server." }, 503);
    }
    console.error("Request history load failed", error);
    return json({ ok: false, code: "HISTORY_LOAD_FAILED", error: "Request history could not be loaded." }, 500);
  }
}

export async function DELETE() {
  const response = json({ ok: true });
  response.cookies.set({
    name: REQUEST_HISTORY_COOKIE,
    value: "",
    ...requestHistoryCookieOptions(),
    maxAge: 0,
  });
  return response;
}
