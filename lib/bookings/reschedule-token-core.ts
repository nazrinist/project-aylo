import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const context = Buffer.from("aylo:booking-reschedule:v1", "utf8");
export const RESCHEDULE_TOKEN_TTL_MS = 10 * 60_000;

const claimsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("start"),
    bookingId: z.string().uuid(),
    bookedFor: z.string().datetime({ offset: true }),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  }).strict(),
  z.object({
    kind: z.literal("option"),
    bookingId: z.string().uuid(),
    bookedFor: z.string().datetime({ offset: true }),
    slotId: z.string().uuid(),
    lastRescheduledAt: z.string().datetime({ offset: true }).nullable(),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  }).strict(),
]);

export type RescheduleClaims = z.infer<typeof claimsSchema>;
export type ReschedulePayload = Omit<Extract<RescheduleClaims, { kind: "start" }>, "issuedAt" | "expiresAt"> |
  Omit<Extract<RescheduleClaims, { kind: "option" }>, "issuedAt" | "expiresAt">;

function key(secret: string) {
  return createHash("sha256").update(context).update("\0", "utf8").update(secret, "utf8").digest();
}

function decode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  return bytes.toString("base64url") === value ? bytes : null;
}

export function sealRescheduleToken(
  payload: ReschedulePayload,
  secret: string,
  now = Date.now(),
  iv = randomBytes(12),
) {
  if (secret.trim().length < 32 || iv.length !== 12) throw new Error("Reschedule encryption unavailable");
  const claims = claimsSchema.parse({ ...payload, issuedAt: now, expiresAt: now + RESCHEDULE_TOKEN_TTL_MS });
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(context);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(claims), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function openRescheduleToken(token: string, secret: string, now = Date.now()): RescheduleClaims | null {
  if (secret.trim().length < 32 || token.length > 2_048) return null;
  const [version, rawIv, rawCipher, rawTag, extra] = token.split(".");
  if (version !== "v1" || extra !== undefined) return null;
  try {
    const iv = decode(rawIv ?? "");
    const ciphertext = decode(rawCipher ?? "");
    const tag = decode(rawTag ?? "");
    if (!iv || !ciphertext || !tag || iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
    decipher.setAAD(context);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const parsed = claimsSchema.safeParse(JSON.parse(plaintext));
    if (!parsed.success) return null;
    const claims = parsed.data;
    if (claims.issuedAt > now + 30_000 || claims.expiresAt <= now ||
      claims.expiresAt - claims.issuedAt !== RESCHEDULE_TOKEN_TTL_MS) return null;
    return claims;
  } catch {
    return null;
  }
}
