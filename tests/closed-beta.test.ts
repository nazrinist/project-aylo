import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BETA_SESSION_TTL_MS,
  openBetaSession,
  sealBetaSession,
} from "../lib/beta/token-core.ts";
import {
  BetaAccessInputSchema,
  BetaFeedbackInputSchema,
} from "../types/beta.ts";

const secret = "day-29-beta-secret-that-is-long-enough";
const claims = {
  participantId: "29000000-0000-4000-8000-000000000001",
  inviteFingerprint: "a".repeat(64),
};

test("beta session is encrypted, authenticated, and expires after seven days", () => {
  const now = Date.UTC(2026, 8, 27, 18, 0, 0);
  const token = sealBetaSession(claims, secret, now, Buffer.alloc(12, 29));
  const opened = openBetaSession(token, secret, now + 1_000);

  assert.deepEqual(opened, {
    ...claims,
    accessMode: "closed",
    issuedAt: now,
    expiresAt: now + BETA_SESSION_TTL_MS,
  });
  assert.equal(openBetaSession(token, "different-secret-that-is-also-long-enough", now), null);
  assert.equal(openBetaSession(token, secret, now + BETA_SESSION_TTL_MS), null);

  const parts = token.split(".");
  parts[2] = `${parts[2]?.slice(0, -1)}${parts[2]?.endsWith("A") ? "B" : "A"}`;
  assert.equal(openBetaSession(parts.join("."), secret, now), null);
});

test("beta input contracts are strict and bounded", () => {
  assert.equal(BetaAccessInputSchema.safeParse({ code: "short" }).success, false);
  assert.equal(
    BetaAccessInputSchema.safeParse({ code: "valid-invite-code", extra: true }).success,
    false,
  );
  assert.deepEqual(
    BetaFeedbackInputSchema.parse({
      outcome: "useful_options",
      easeRating: 4,
      comment: "   ",
    }),
    { outcome: "useful_options", easeRating: 4, comment: null },
  );
  for (const invalid of [
    { outcome: "booked", easeRating: 4 },
    { outcome: "no_match", easeRating: 0 },
    { outcome: "technical_issue", easeRating: 6 },
    { outcome: "useful_options", easeRating: 4, comment: "x".repeat(1001) },
  ]) {
    assert.equal(BetaFeedbackInputSchema.safeParse(invalid).success, false);
  }
});

test("closed beta secrets stay server-side and use constant-time invite checks", async () => {
  const [session, token] = await Promise.all([
    readFile(new URL("../lib/beta/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/beta/token-core.ts", import.meta.url), "utf8"),
  ]);

  assert.match(session, /import "server-only"/);
  assert.match(session, /timingSafeEqual/);
  assert.match(session, /AYLO_BETA_MODE/);
  assert.match(session, /AYLO_BETA_SECRET/);
  assert.match(session, /AYLO_BETA_INVITE_CODES/);
  assert.doesNotMatch(session, /NEXT_PUBLIC_/);
  assert.match(session, /httpOnly: true/);
  assert.match(session, /sameSite: "strict"/);
  assert.match(session, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(token, /aes-256-gcm/);
  assert.match(token, /setAAD/);
  assert.match(token, /setAuthTag/);
});

test("proxy gates product routes while leaving access, health, and policy pages public", async () => {
  const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");

  assert.match(proxy, /BETA_SESSION_COOKIE/);
  assert.match(proxy, /getBetaAccessState/);
  assert.match(proxy, /BETA_ACCESS_REQUIRED/);
  assert.match(proxy, /NextResponse\.redirect\(betaUrl\)/);
  assert.match(proxy, /"\/api\/beta\/access"/);
  assert.match(proxy, /"\/api\/health"/);
  assert.match(proxy, /"\/privacy"/);
  assert.match(proxy, /"\/robots\.txt"/);
  assert.match(proxy, /PUBLIC_PAGE_PATHS/);
  assert.match(proxy, /_next\/static\|_next\/image\|favicon\.ico/);
  assert.doesNotMatch(proxy, /localStorage|sessionStorage/);
});

test("consumer APIs recheck beta access before parsing payloads", async () => {
  const paths = [
    "../app/api/intent/route.ts",
    "../app/api/search/route.ts",
    "../app/api/bookings/route.ts",
    "../app/api/tools/check-availability/route.ts",
    "../app/api/tools/search-providers/route.ts",
    "../app/api/history/route.ts",
    "../app/api/preferences/route.ts",
  ];

  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /requireBetaAccess/);
    assert.match(source, /if \(betaAccessError\) return betaAccessError/);
    const accessIndex = source.indexOf("requireBetaAccess(request)") >= 0
      ? source.indexOf("requireBetaAccess(request)")
      : source.indexOf("requireBetaAccess(req)");
    const parseIndex = source.indexOf("await request.json()") >= 0
      ? source.indexOf("await request.json()")
      : source.indexOf("await req.json()");
    if (parseIndex >= 0) assert.ok(accessIndex >= 0 && accessIndex < parseIndex, path);
  }
});

test("beta UI keeps codes out of browser storage and minimizes feedback data", async () => {
  const [accessPage, feedback] = await Promise.all([
    readFile(new URL("../app/beta/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/beta-feedback.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(accessPage, /type="password"/);
  assert.match(accessPage, /fetch\("\/api\/beta\/access"/);
  assert.match(accessPage, /HttpOnly seven-day session/);
  assert.doesNotMatch(accessPage, /localStorage|sessionStorage|document\.cookie/);
  assert.match(feedback, /Do not include names, contact details, health, or payment information/);
  assert.doesNotMatch(feedback, /email|phone|user-agent|ip address/i);
});

test("beta tables are private, additive, and contain no identity fields", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/0011_closed_beta.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.beta_participants/);
  assert.match(sql, /create table if not exists public\.beta_feedback/);
  assert.match(sql, /alter table public\.beta_participants enable row level security/);
  assert.match(sql, /alter table public\.beta_feedback enable row level security/);
  assert.match(sql, /revoke all on table public\.beta_participants from anon, authenticated/);
  assert.match(sql, /revoke all on table public\.beta_feedback from anon, authenticated/);
  assert.doesNotMatch(sql, /^\s*(email|phone|ip_address|user_agent|original_request)\s/mi);
  assert.doesNotMatch(sql, /\b(drop|truncate|delete)\b/i);
});

test("feedback writes require both beta access and server-only Supabase", async () => {
  const route = await readFile(
    new URL("../app/api/beta/feedback/route.ts", import.meta.url),
    "utf8",
  );
  const data = await readFile(new URL("../lib/beta/data.ts", import.meta.url), "utf8");

  assert.ok(route.indexOf("requireBetaAccess(request)") < route.indexOf("request.json()"));
  assert.match(route, /isSupabaseAdminConfigured/);
  assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
  assert.match(data, /import "server-only"/);
  assert.match(data, /ignoreDuplicates: true/);
  assert.match(data, /participant_id: claims\.participantId/);
});
