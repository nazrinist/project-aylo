import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  BETA_SESSION_TTL_MS,
  openBetaSession,
  sealBetaSession,
  type BetaSessionClaims,
} from "@/lib/beta/token-core";

export const BETA_SESSION_COOKIE = "aylo_beta_session";
const MAX_INVITE_CODES = 100;

export type BetaMode = "open" | "closed" | "public";

type ClosedBetaConfig = {
  secret: string;
  inviteCodes: string[];
};

export type BetaAccessState =
  | { mode: "open"; configured: true; authenticated: true; claims: null }
  | {
      mode: "public";
      configured: boolean;
      authenticated: boolean;
      claims: BetaSessionClaims | null;
    }
  | {
      mode: "closed";
      configured: boolean;
      authenticated: boolean;
      claims: BetaSessionClaims | null;
    };

export function getBetaMode(): BetaMode {
  const mode = process.env.AYLO_BETA_MODE?.trim().toLowerCase();
  if (mode === "closed" || mode === "public") return mode;
  if (mode === "open") return "open";
  return process.env.NODE_ENV === "production" ? "closed" : "open";
}

function getBetaSessionSecret() {
  const secret = process.env.AYLO_BETA_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : null;
}

function getClosedBetaConfig(): ClosedBetaConfig | null {
  if (getBetaMode() !== "closed") return null;
  const secret = getBetaSessionSecret();
  const rawCodes = process.env.AYLO_BETA_INVITE_CODES ?? "";
  const inviteCodes = rawCodes.split(",").map((code) => code.trim()).filter(Boolean);
  const codesAreValid =
    inviteCodes.length > 0 &&
    inviteCodes.length <= MAX_INVITE_CODES &&
    inviteCodes.every((code) => code.length >= 16 && code.length <= 128) &&
    new Set(inviteCodes).size === inviteCodes.length;
  if (!secret || !codesAreValid) return null;
  return { secret, inviteCodes };
}

function codeDigest(code: string) {
  return createHash("sha256").update(code, "utf8").digest();
}

function matchInviteCode(input: string, inviteCodes: string[]) {
  const inputDigest = codeDigest(input.trim());
  let matchedFingerprint: string | null = null;
  for (const candidate of inviteCodes) {
    const candidateDigest = codeDigest(candidate);
    if (timingSafeEqual(inputDigest, candidateDigest)) {
      matchedFingerprint = candidateDigest.toString("hex");
    }
  }
  return matchedFingerprint;
}

function inviteFingerprintIsActive(fingerprint: string, inviteCodes: string[]) {
  const fingerprintDigest = Buffer.from(fingerprint, "hex");
  let active = false;
  for (const candidate of inviteCodes) {
    if (timingSafeEqual(fingerprintDigest, codeDigest(candidate))) active = true;
  }
  return active;
}

export function getBetaAccessState(token: string | undefined): BetaAccessState {
  const mode = getBetaMode();
  if (mode === "open") {
    return { mode: "open", configured: true, authenticated: true, claims: null };
  }
  if (mode === "public") {
    const secret = getBetaSessionSecret();
    const openedClaims = secret && token ? openBetaSession(token, secret) : null;
    const claims = openedClaims?.accessMode === "public" ? openedClaims : null;
    return {
      mode: "public",
      configured: Boolean(secret),
      authenticated: Boolean(secret),
      claims,
    };
  }
  const config = getClosedBetaConfig();
  if (!config) {
    return { mode: "closed", configured: false, authenticated: false, claims: null };
  }
  const openedClaims = token ? openBetaSession(token, config.secret) : null;
  const claims = openedClaims?.accessMode === "closed" &&
    openedClaims.inviteFingerprint !== null &&
    inviteFingerprintIsActive(openedClaims.inviteFingerprint, config.inviteCodes)
    ? openedClaims
    : null;
  return {
    mode: "closed",
    configured: true,
    authenticated: Boolean(claims),
    claims,
  };
}

export function createBetaSession(code: string, currentToken?: string) {
  const config = getClosedBetaConfig();
  if (!config) return null;
  const inviteFingerprint = matchInviteCode(code, config.inviteCodes);
  if (!inviteFingerprint) return null;

  const currentClaims = currentToken
    ? openBetaSession(currentToken, config.secret)
    : null;
  const claims = {
    participantId: currentClaims?.accessMode === "closed"
      ? currentClaims.participantId
      : randomUUID(),
    accessMode: "closed" as const,
    inviteFingerprint,
  };
  return {
    claims,
    token: sealBetaSession(claims, config.secret),
  };
}

export function createPublicBetaSession(currentToken?: string) {
  if (getBetaMode() !== "public") return null;
  const secret = getBetaSessionSecret();
  if (!secret) return null;
  const currentClaims = currentToken ? openBetaSession(currentToken, secret) : null;
  const claims = {
    participantId: currentClaims?.accessMode === "public"
      ? currentClaims.participantId
      : randomUUID(),
    accessMode: "public" as const,
    inviteFingerprint: null,
  };
  return {
    claims,
    token: sealBetaSession(claims, secret),
  };
}

export function betaSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BETA_SESSION_TTL_MS / 1000,
    priority: "high" as const,
  };
}
