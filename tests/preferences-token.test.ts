import assert from "node:assert/strict";
import test from "node:test";
import {
  openPreferencesToken,
  PREFERENCES_TOKEN_TTL_MS,
  sealPreferencesToken,
} from "../lib/preferences/token-core.ts";

const secret = "day-23-preferences-secret-that-is-long-enough";
const now = Date.parse("2026-09-23T10:00:00.000Z");
const iv = Buffer.from("00112233445566778899aabb", "hex");
const preferences = { location: "Ağ Şəhər, Bakı", budgetMax: 120, currency: "AZN" };

test("preferences token is opaque, authenticated and time-bound", () => {
  const token = sealPreferencesToken(preferences, secret, now, iv);
  assert.doesNotMatch(token, /Ağ Şəhər|120|AZN/);
  assert.deepEqual(openPreferencesToken(token, secret, now + 1), {
    preferences,
    issuedAt: now,
    expiresAt: now + PREFERENCES_TOKEN_TTL_MS,
  });
  assert.equal(openPreferencesToken(token, `${secret}-wrong`, now + 1), null);
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(openPreferencesToken(tampered, secret, now + 1), null);
  assert.equal(openPreferencesToken(token, secret, now + PREFERENCES_TOKEN_TTL_MS), null);
});

test("preferences token normalizes currency and rejects invalid values", () => {
  const token = sealPreferencesToken({ ...preferences, currency: "azn" }, secret, now, iv);
  assert.equal(openPreferencesToken(token, secret, now + 1)?.preferences.currency, "AZN");
  assert.throws(() => sealPreferencesToken({ ...preferences, budgetMax: -1 }, secret, now, iv));
  assert.throws(() => sealPreferencesToken(preferences, "too-short", now, iv), /not configured/);
});
