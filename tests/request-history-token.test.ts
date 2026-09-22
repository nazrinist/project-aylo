import assert from "node:assert/strict";
import test from "node:test";
import {
  openRequestHistoryToken,
  prependRequestHistoryId,
  REQUEST_HISTORY_LIMIT,
  REQUEST_HISTORY_TOKEN_TTL_MS,
  sealRequestHistoryToken,
} from "../lib/history/token-core.ts";

const secret = "day-22-request-history-secret-that-is-long-enough";
const now = Date.parse("2026-09-21T10:00:00.000Z");
const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";
const iv = Buffer.from("00112233445566778899aabb", "hex");

test("request history token is opaque, authenticated and time-bound", () => {
  const token = sealRequestHistoryToken([firstId, secondId], secret, now, iv);
  assert.doesNotMatch(token, new RegExp(firstId));
  assert.deepEqual(openRequestHistoryToken(token, secret, now + 1), {
    requestIds: [firstId, secondId],
    issuedAt: now,
    expiresAt: now + REQUEST_HISTORY_TOKEN_TTL_MS,
  });
  assert.equal(openRequestHistoryToken(token, `${secret}-wrong`, now + 1), null);
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(openRequestHistoryToken(tampered, secret, now + 1), null);
  assert.equal(openRequestHistoryToken(token, secret, now + REQUEST_HISTORY_TOKEN_TTL_MS), null);
});

test("request history keeps the newest unique IDs within the cookie limit", () => {
  const existing = Array.from({ length: REQUEST_HISTORY_LIMIT }, (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );
  assert.deepEqual(prependRequestHistoryId(existing, existing[5]), [existing[5], ...existing.filter((id) => id !== existing[5])]);
  const newest = "10000000-0000-4000-8000-000000000001";
  const rolled = prependRequestHistoryId(existing, newest);
  assert.equal(rolled.length, REQUEST_HISTORY_LIMIT);
  assert.equal(rolled[0], newest);
  assert.equal(rolled.at(-1), existing.at(-2));
});

test("request history refuses weak secrets and invalid identifiers", () => {
  assert.throws(() => sealRequestHistoryToken([firstId], "too-short", now, iv), /not configured/);
  assert.throws(() => prependRequestHistoryId([], "not-a-uuid"));
});
