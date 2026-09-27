import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

const TOKEN_VERSION = "v1";
const TOKEN_CONTEXT = Buffer.from("aylo:closed-beta:v1", "utf8");
const TOKEN_IV_BYTES = 12;
const TOKEN_TAG_BYTES = 16;
const MAX_CLOCK_SKEW_MS = 30_000;

export const BETA_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BetaSessionClaimsSchema = z
  .object({
    participantId: z.string().uuid(),
    inviteFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type BetaSessionClaims = z.infer<typeof BetaSessionClaimsSchema>;

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

export function sealBetaSession(
  claims: Pick<BetaSessionClaims, "participantId" | "inviteFingerprint">,
  secret: string,
  nowMs = Date.now(),
  iv = randomBytes(TOKEN_IV_BYTES),
) {
  if (!validSecret(secret)) throw new Error("Beta session secret is not configured");
  if (iv.length !== TOKEN_IV_BYTES) throw new Error("Beta session IV must be 12 bytes");

  const payload = BetaSessionClaimsSchema.parse({
    ...claims,
    issuedAt: nowMs,
    expiresAt: nowMs + BETA_SESSION_TTL_MS,
  });
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(TOKEN_CONTEXT);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
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

export function openBetaSession(
  token: string,
  secret: string,
  nowMs = Date.now(),
): BetaSessionClaims | null {
  if (!validSecret(secret) || token.length > 2_048) return null;
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = token.split(".");
  if (version !== TOKEN_VERSION || extra !== undefined) return null;

  try {
    const iv = decodeCanonicalBase64url(encodedIv ?? "");
    const ciphertext = decodeCanonicalBase64url(encodedCiphertext ?? "");
    const tag = decodeCanonicalBase64url(encodedTag ?? "");
    if (
      !iv ||
      !ciphertext ||
      !tag ||
      iv.length !== TOKEN_IV_BYTES ||
      tag.length !== TOKEN_TAG_BYTES
    ) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
    decipher.setAAD(TOKEN_CONTEXT);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const parsed = BetaSessionClaimsSchema.safeParse(JSON.parse(plaintext));
    if (!parsed.success) return null;

    const claims = parsed.data;
    if (
      claims.issuedAt > nowMs + MAX_CLOCK_SKEW_MS ||
      claims.expiresAt <= nowMs ||
      claims.expiresAt - claims.issuedAt !== BETA_SESSION_TTL_MS
    ) return null;
    return claims;
  } catch {
    return null;
  }
}
