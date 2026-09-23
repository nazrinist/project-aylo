import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import { SearchPreferencesSchema } from "@/types/preferences";

const TOKEN_VERSION = "v1";
const TOKEN_CONTEXT = Buffer.from("aylo:search-preferences:v1", "utf8");
const TOKEN_IV_BYTES = 12;
const TOKEN_TAG_BYTES = 16;
const MAX_CLOCK_SKEW_MS = 30_000;

export const PREFERENCES_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const PreferencesClaimsSchema = z
  .object({
    preferences: SearchPreferencesSchema,
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

function encryptionKey(secret: string) {
  return createHash("sha256")
    .update(TOKEN_CONTEXT)
    .update("\0", "utf8")
    .update(secret, "utf8")
    .digest();
}

function validSecret(secret: string) {
  return secret.trim().length >= 32;
}

function decodeCanonicalBase64url(value: string) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

export function sealPreferencesToken(
  preferences: unknown,
  secret: string,
  nowMs = Date.now(),
  iv = randomBytes(TOKEN_IV_BYTES),
) {
  if (!validSecret(secret)) throw new Error("Preferences secret is not configured");
  if (iv.length !== TOKEN_IV_BYTES) throw new Error("Preferences IV must be 12 bytes");

  const claims = PreferencesClaimsSchema.parse({
    preferences,
    issuedAt: nowMs,
    expiresAt: nowMs + PREFERENCES_TOKEN_TTL_MS,
  });
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(TOKEN_CONTEXT);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function openPreferencesToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
) {
  if (!validSecret(secret) || token.length > 2_048) return null;
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = token.split(".");
  if (version !== TOKEN_VERSION || extra !== undefined) return null;

  try {
    const iv = decodeCanonicalBase64url(encodedIv ?? "");
    const ciphertext = decodeCanonicalBase64url(encodedCiphertext ?? "");
    const tag = decodeCanonicalBase64url(encodedTag ?? "");
    if (!iv || !ciphertext || !tag || iv.length !== TOKEN_IV_BYTES || tag.length !== TOKEN_TAG_BYTES) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
    decipher.setAAD(TOKEN_CONTEXT);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const parsed = PreferencesClaimsSchema.safeParse(JSON.parse(plaintext));
    if (!parsed.success) return null;

    const claims = parsed.data;
    if (
      claims.issuedAt > nowMs + MAX_CLOCK_SKEW_MS ||
      claims.expiresAt <= nowMs ||
      claims.expiresAt - claims.issuedAt !== PREFERENCES_TOKEN_TTL_MS
    ) return null;
    return claims;
  } catch {
    return null;
  }
}
