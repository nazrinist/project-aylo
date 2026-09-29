import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BETA_SESSION_TTL_MS,
  openBetaSession,
  sealBetaSession,
} from "../lib/beta/token-core.ts";
import { PUBLIC_BETA_RATE_LIMITS } from "../lib/beta/rate-limit-shared.ts";

const secret = "day-30-public-beta-secret-is-long-enough";
const participantId = "30000000-0000-4000-8000-000000000001";

test("public beta sessions are encrypted, anonymous, and mode-bound", () => {
  const now = Date.UTC(2026, 8, 28, 11, 0, 0);
  const token = sealBetaSession(
    {
      participantId,
      accessMode: "public",
      inviteFingerprint: null,
    },
    secret,
    now,
    Buffer.alloc(12, 30),
  );

  assert.deepEqual(openBetaSession(token, secret, now + 1_000), {
    participantId,
    accessMode: "public",
    inviteFingerprint: null,
    issuedAt: now,
    expiresAt: now + BETA_SESSION_TTL_MS,
  });
  assert.equal(openBetaSession(token, `${secret}-wrong`, now), null);
});

test("public beta limits are explicit, bounded, and action-specific", () => {
  assert.deepEqual(Object.keys(PUBLIC_BETA_RATE_LIMITS).sort(), [
    "booking",
    "check_availability",
    "feedback",
    "intent",
    "search",
    "search_providers",
  ]);
  assert.deepEqual(PUBLIC_BETA_RATE_LIMITS.intent, {
    limit: 20,
    windowSeconds: 600,
  });
  assert.deepEqual(PUBLIC_BETA_RATE_LIMITS.booking, {
    limit: 5,
    windowSeconds: 600,
  });
  for (const policy of Object.values(PUBLIC_BETA_RATE_LIMITS)) {
    assert.ok(policy.limit >= 1 && policy.limit <= 30);
    assert.ok(policy.windowSeconds >= 60 && policy.windowSeconds <= 3_600);
  }
});

test("public mode creates a secure session but keeps closed-beta rollback", async () => {
  const [session, proxy, access] = await Promise.all([
    readFile(new URL("../lib/beta/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/beta/access/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(session, /"open" \| "closed" \| "public"/);
  assert.match(session, /NODE_ENV === "production" \? "closed" : "open"/);
  assert.match(session, /createPublicBetaSession/);
  assert.match(session, /accessMode: "public"/);
  assert.match(session, /inviteFingerprint: null/);
  assert.match(session, /getBetaMode\(\) !== "public"/);
  assert.match(proxy, /state\.mode === "public"/);
  assert.match(proxy, /response\.cookies\.set/);
  assert.match(proxy, /"Cache-Control", "private, no-store"/);
  assert.match(proxy, /"Vary", "Cookie"/);
  assert.match(proxy, /"\/privacy"/);
  assert.match(access, /participantReady/);
  assert.match(access, /registerBetaParticipant\(publicSession\.claims\)/);
  assert.match(access, /getBetaMode\(\) === "public"/);
});

test("expensive public routes rate-limit before reading request bodies", async () => {
  const routes = [
    ["../app/api/intent/route.ts", "intent"],
    ["../app/api/search/route.ts", "search"],
    ["../app/api/bookings/route.ts", "booking"],
    ["../app/api/bookings/cancel/route.ts", "booking"],
    ["../app/api/beta/feedback/route.ts", "feedback"],
    ["../app/api/tools/search-providers/route.ts", "search_providers"],
    ["../app/api/tools/check-availability/route.ts", "check_availability"],
  ] as const;

  for (const [path, action] of routes) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const accessIndex = source.indexOf("requireBetaAccess(");
    const limitIndex = source.indexOf("requirePublicBetaRateLimit(");
    const parseIndex = source.indexOf(".json()");
    assert.ok(accessIndex >= 0, `${path} must check beta access`);
    assert.ok(limitIndex > accessIndex, `${path} must limit after access`);
    assert.ok(parseIndex < 0 || limitIndex < parseIndex, `${path} must limit before parsing`);
    assert.match(source, new RegExp(`"${action}"`));
  }
});

test("rate-limit failures are private, generic, and retryable", async () => {
  const [limiter, data] = await Promise.all([
    readFile(new URL("../lib/beta/rate-limit.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/beta/data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(limiter, /import "server-only"/);
  assert.match(limiter, /status: 429/);
  assert.match(limiter, /"Retry-After"/);
  assert.match(limiter, /"Cache-Control": "private, no-store"/);
  assert.match(limiter, /PUBLIC_BETA_RATE_LIMIT_UNAVAILABLE/);
  assert.doesNotMatch(limiter, /error instanceof Error \? error\.message/);
  assert.match(data, /consume_beta_rate_limit/);
  assert.match(data, /access_mode: claims\.accessMode/);
});

test("public beta migration is additive, private, and stores no network identity", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/0012_public_beta.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /add column if not exists access_mode/);
  assert.match(sql, /alter column invite_fingerprint drop not null/);
  assert.match(sql, /create table if not exists public\.beta_rate_limits/);
  assert.match(sql, /alter table public\.beta_rate_limits enable row level security/);
  assert.match(sql, /revoke all on table public\.beta_rate_limits from anon, authenticated/);
  assert.match(sql, /security definer/);
  assert.match(sql, /consume_beta_rate_limit/);
  assert.doesNotMatch(sql, /^\s*(ip_address|user_agent|email|phone)\s/mi);
  assert.doesNotMatch(sql, /\b(drop table|truncate table|delete from)\b/i);
});

test("public feedback and launch UI preserve privacy and separate operator tools", async () => {
  const [feedback, feedbackRoute, home, privacy, health] = await Promise.all([
    readFile(new URL("../app/components/beta-feedback.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/beta/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(feedback, /status\.mode === "public"/);
  assert.match(feedback, /Public beta feedback/);
  assert.match(feedbackRoute, /state\.mode === "open"/);
  assert.doesNotMatch(feedbackRoute, /CLOSED_ONLY/);
  assert.match(home, /AYLO <span>public beta<\/span>/);
  assert.match(home, /href="\/privacy"/);
  assert.doesNotMatch(home, /href="\/(dashboard|leads|analytics|businesses|availability)"/);
  assert.match(privacy, /do not store your name/);
  assert.match(privacy, /does not collect payment/);
  assert.doesNotMatch(health, /error instanceof Error \? error\.message/);
});

test("public launch adds recovery UI, crawler boundaries, and security headers", async () => {
  const [errorPage, notFound, robots, config] = await Promise.all([
    readFile(new URL("../app/error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(errorPage, /reset/);
  assert.match(notFound, /href="\/"/);
  assert.match(robots, /"\/api\/"/);
  assert.match(robots, /"\/dashboard"/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /X-Frame-Options/);
  assert.match(config, /Referrer-Policy/);
  assert.match(config, /Permissions-Policy/);
});
