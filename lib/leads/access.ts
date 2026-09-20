import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const MINIMUM_OPERATOR_TOKEN_LENGTH = 32;

function configuredToken() {
  return process.env.AYLO_OPERATOR_TOKEN?.trim() ?? "";
}

function bearerToken(authorization: string | null) {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";
  return token && !/\s/.test(token) ? token : null;
}

function tokenDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isLeadAccessConfigured() {
  return getLeadAccessSecret() !== null;
}

export function getLeadAccessSecret() {
  const token = configuredToken();
  return token.length >= MINIMUM_OPERATOR_TOKEN_LENGTH ? token : null;
}

export function verifyLeadAuthorization(authorization: string | null) {
  const expected = getLeadAccessSecret();
  const provided = bearerToken(authorization);

  if (!expected || !provided) {
    return false;
  }

  return timingSafeEqual(tokenDigest(expected), tokenDigest(provided));
}
