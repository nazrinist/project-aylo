import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("history access uses an encrypted HttpOnly browser cookie", async () => {
  const token = await readFile(new URL("../lib/history/token-core.ts", import.meta.url), "utf8");
  const session = await readFile(new URL("../lib/history/session.ts", import.meta.url), "utf8");
  assert.match(token, /aes-256-gcm/);
  assert.match(token, /setAAD/);
  assert.match(token, /setAuthTag/);
  assert.match(session, /import "server-only"/);
  assert.match(session, /httpOnly: true/);
  assert.match(session, /sameSite: "lax"/);
  assert.match(session, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(session, /trim\(\)\.length >= 32/);
});

test("history DAL authorizes by cookie IDs and returns a minimal DTO", async () => {
  const source = await readFile(new URL("../lib/history/data.ts", import.meta.url), "utf8");
  const requestSelect = source.match(/\.from\("requests"\)\s*\.select\(\s*"([^"]+)"/);
  assert.match(source, /import "server-only"/);
  assert.match(source, /readRequestHistoryIds\(historyToken\)/);
  assert.match(source, /\.in\("id", requestIds\)/);
  assert.equal(requestSelect?.[1], "id,original_request,services,location,budget_min,budget_max,currency,requested_date,time_from,time_to,status,result_count,created_at");
  assert.doesNotMatch(requestSelect?.[1] ?? "", /user_id/);
});

test("history API disables shared caching and never accepts client IDs", async () => {
  const route = await readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8");
  assert.match(route, /request\.cookies\.get\(REQUEST_HISTORY_COOKIE\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Vary: "Cookie"/);
  assert.match(route, /searchParams\.size > 0/);
  assert.doesNotMatch(route, /searchParams\.get\(["'](?:id|requestId)["']\)/);
});

test("search attaches history only after a persisted request is ready", async () => {
  const route = await readFile(new URL("../app/api/search/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(bookingRequestId\)/);
  assert.match(route, /rollRequestHistoryToken/);
  assert.match(route, /response\.cookies\.set/);
  assert.ok(route.indexOf("const requestReady = await finishSearchRequest") < route.indexOf("const historyToken = rollRequestHistoryToken"));
});

test("history page does not expose its access cookie to JavaScript", async () => {
  const page = await readFile(new URL("../app/history/page.tsx", import.meta.url), "utf8");
  assert.match(page, /fetch\("\/api\/history"/);
  assert.match(page, /This browser only/);
  assert.match(page, /Private database records are not deleted/);
  assert.match(page, /window\.confirm/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
});
