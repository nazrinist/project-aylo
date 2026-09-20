import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import test from "node:test";

test("lead decisions re-authorize, decrypt an opaque token, and use one RPC", async () => {
  const dal = await readFile(
    new URL("../lib/leads/decision.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/leads/decision/route.ts", import.meta.url),
    "utf8",
  );
  const token = await readFile(
    new URL("../lib/leads/action-token-core.ts", import.meta.url),
    "utf8",
  );

  assert.match(dal, /import "server-only"/);
  assert.match(dal, /verifyLeadAuthorization\(authorization\)/);
  assert.match(dal, /verifyLeadActionToken\(input\.actionToken\)/);
  assert.ok(
    dal.indexOf("verifyLeadAuthorization(authorization)") <
      dal.indexOf("verifyLeadActionToken(input.actionToken)"),
  );
  assert.match(dal, /\.rpc\("decide_booking_lead"/);
  assert.doesNotMatch(dal, /\.from\("bookings"\).*\.update/s);
  assert.match(route, /request\.headers\.get\("authorization"\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /WWW-Authenticate/);
  assert.match(token, /aes-256-gcm/);
  assert.match(token, /setAuthTag/);
});

test("lead decision migration locks both records and enforces final transitions", () => {
  const sql = readFileSync(
    "supabase/migrations/0007_lead_decisions.sql",
    "utf8",
  );

  assert.ok((sql.match(/for update;/gi) ?? []).length >= 2);
  assert.match(sql, /v_booking\.status <> 'pending_confirmation'/);
  assert.match(sql, /v_booking\.status = p_target_status/);
  assert.match(sql, /p_target_status not in \('accepted', 'rejected'\)/);
  assert.match(sql, /set\s+status = p_target_status/);
  assert.match(sql, /when start_time > now\(\) then 'available'/);
  assert.match(sql, /else 'blocked'/);
  assert.match(sql, /merchant_responded_at = now\(\)/);
  assert.match(sql, /set search_path = pg_catalog, pg_temp/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /update public\.requests/);
});

test("lead decision UI never persists the operator token in browser storage", async () => {
  const page = await readFile(
    new URL("../app/leads/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
  assert.match(page, /Authorization: `Bearer \$\{operatorToken\.trim\(\)\}`/);
  assert.match(page, /confirmed: true/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /Final confirmation/);
});
