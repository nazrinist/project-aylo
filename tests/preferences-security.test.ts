import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("preferences use an encrypted HttpOnly browser cookie", async () => {
  const token = await readFile(new URL("../lib/preferences/token-core.ts", import.meta.url), "utf8");
  const session = await readFile(new URL("../lib/preferences/session.ts", import.meta.url), "utf8");
  assert.match(token, /aes-256-gcm/);
  assert.match(token, /setAAD/);
  assert.match(token, /setAuthTag/);
  assert.match(session, /import "server-only"/);
  assert.match(session, /httpOnly: true/);
  assert.match(session, /sameSite: "lax"/);
  assert.match(session, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(session, /PREFERENCES_SECRET/);
});

test("preferences API validates input and disables shared caching", async () => {
  const route = await readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8");
  assert.match(route, /SearchPreferencesSchema\.parse/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Vary: "Cookie"/);
  assert.match(route, /searchParams\.size > 0/);
  assert.match(route, /maxAge: 0/);
});

test("intent applies server-read preferences before choosing a follow-up", async () => {
  const route = await readFile(new URL("../app/api/intent/route.ts", import.meta.url), "utf8");
  assert.match(route, /req\.cookies\.get\(PREFERENCES_COOKIE\)/);
  assert.ok(route.indexOf("applySearchPreferences") < route.lastIndexOf("nextFollowUpQuestion"));
});

test("preferences page cannot read its cookie or use browser storage", async () => {
  const page = await readFile(new URL("../app/preferences/page.tsx", import.meta.url), "utf8");
  assert.match(page, /fetch\("\/api\/preferences"/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /your request always wins/i);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
});
