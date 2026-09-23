import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  createPreferencesToken,
  getPreferencesSecret,
  PREFERENCES_COOKIE,
  preferencesCookieOptions,
  readPreferences,
} from "@/lib/preferences/session";
import {
  EMPTY_SEARCH_PREFERENCES,
  SearchPreferencesSchema,
} from "@/types/preferences";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.size > 0) {
    return json({ ok: false, code: "PREFERENCES_QUERY_INVALID", error: "Preferences do not accept query parameters." }, 400);
  }
  const configured = Boolean(getPreferencesSecret());
  return json({
    ok: true,
    configured,
    preferences: configured
      ? readPreferences(request.cookies.get(PREFERENCES_COOKIE)?.value)
      : EMPTY_SEARCH_PREFERENCES,
  });
}

export async function PUT(request: NextRequest) {
  try {
    if (!getPreferencesSecret()) {
      return json({ ok: false, code: "PREFERENCES_SECRET_MISSING", error: "Add a 32+ character PREFERENCES_SECRET and restart the server." }, 503);
    }
    const preferences = SearchPreferencesSchema.parse(await request.json());
    const token = createPreferencesToken(preferences);
    if (!token) throw new Error("Preferences encryption is unavailable");
    const response = json({ ok: true, configured: true, preferences });
    response.cookies.set({ name: PREFERENCES_COOKIE, value: token, ...preferencesCookieOptions() });
    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json({ ok: false, code: "PREFERENCES_INVALID", error: "Use a valid location, positive maximum budget, and three-letter currency." }, 400);
    }
    console.error("Preferences save failed", error);
    return json({ ok: false, code: "PREFERENCES_SAVE_FAILED", error: "Preferences could not be saved." }, 500);
  }
}

export async function DELETE() {
  const response = json({ ok: true, configured: Boolean(getPreferencesSecret()), preferences: EMPTY_SEARCH_PREFERENCES });
  response.cookies.set({
    name: PREFERENCES_COOKIE,
    value: "",
    ...preferencesCookieOptions(),
    maxAge: 0,
  });
  return response;
}
