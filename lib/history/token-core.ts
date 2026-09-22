import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

const TOKEN_VERSION = "v1";
const TOKEN_CONTEXT = Buffer.from("aylo:request-history:v1", "utf8");
const TOKEN_IV_BYTES = 12;
const TOKEN_TAG_BYTES = 16;
const MAX_CLOCK_SKEW_MS = 30_000;

export const REQUEST_HISTORY_LIMIT = 20;
export const REQUEST_HISTORY_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const RequestHistoryClaimsSchema = z
  .object({
    requestIds: z.array(z.string().uuid()).max(REQUEST_HISTORY_LIMIT),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict()
  .refine(
    (claims) => new Set(claims.requestIds).size === claims.requestIds.length,
    "Request history IDs must be unique",
  );

export type RequestHistoryClaims = z.infer<typeof RequestHistoryClaimsSchema>;

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
  if (value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

export function prependRequestHistoryId(requestIds: string[], requestId: string) {
  const id = z.string().uuid().parse(requestId).toLowerCase();
  const validExisting = requestIds.flatMap((candidate) => {
    const parsed = z.string().uuid().safeParse(candidate);
    return parsed.success ? [parsed.data.toLowerCase()] : [];
  });
  return [id, ...validExisting.filter((candidate) => candidate !== id)]
    .slice(0, REQUEST_HISTORY_LIMIT);
}

export function sealRequestHistoryToken(
  requestIds: string[],
  secret: string,
  nowMs = Date.now(),
  iv = randomBytes(TOKEN_IV_BYTES),
) {
  if (!validSecret(secret)) throw new Error("Request history secret is not configured");
  if (iv.length !== TOKEN_IV_BYTES) throw new Error("Request history IV must be 12 bytes");

  const claims = RequestHistoryClaimsSchema.parse({
    requestIds,
    issuedAt: nowMs,
    expiresAt: nowMs + REQUEST_HISTORY_TOKEN_TTL_MS,
  });
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(TOKEN_CONTEXT);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [TOKEN_VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function openRequestHistoryToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): RequestHistoryClaims | null {
  if (!validSecret(secret) || token.length > 4_096) return null;
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
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const parsed = RequestHistoryClaimsSchema.safeParse(JSON.parse(plaintext));
    if (!parsed.success) return null;
    const claims = parsed.data;
    if (
      claims.issuedAt > nowMs + MAX_CLOCK_SKEW_MS ||
      claims.expiresAt <= nowMs ||
      claims.expiresAt - claims.issuedAt !== REQUEST_HISTORY_TOKEN_TTL_MS
    ) return null;
    return claims;
  } catch {
    return null;
  }
}
