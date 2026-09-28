import "server-only";

import type { BetaSessionClaims } from "@/lib/beta/token-core";
import type { BetaFeedbackInput } from "@/types/beta";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";

type BetaParticipant = Pick<
  BetaSessionClaims,
  "participantId" | "accessMode" | "inviteFingerprint"
>;

export type BetaRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function registerBetaParticipant(claims: BetaParticipant) {
  if (!isSupabaseAdminConfigured()) return false;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("beta_participants")
    .upsert(
      {
        id: claims.participantId,
        access_mode: claims.accessMode,
        invite_fingerprint: claims.inviteFingerprint,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  return true;
}

export async function saveBetaFeedback(
  claims: BetaParticipant,
  input: BetaFeedbackInput,
) {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Beta feedback storage is unavailable");
  }
  const supabase = getSupabaseAdminClient();
  const { error: participantError } = await supabase
    .from("beta_participants")
    .upsert(
      {
        id: claims.participantId,
        access_mode: claims.accessMode,
        invite_fingerprint: claims.inviteFingerprint,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (participantError) throw new Error(participantError.message);

  const { error: feedbackError } = await supabase.from("beta_feedback").insert({
    participant_id: claims.participantId,
    outcome: input.outcome,
    ease_rating: input.easeRating,
    comment: input.comment,
  });
  if (feedbackError) throw new Error(feedbackError.message);
}

export async function consumeBetaRateLimit(
  claims: BetaParticipant,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<BetaRateLimitResult> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Beta rate-limit storage is unavailable");
  }
  await registerBetaParticipant(claims);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consume_beta_rate_limit", {
    p_participant_id: claims.participantId,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row.allowed !== "boolean" ||
    !Number.isInteger(row.remaining) ||
    !Number.isInteger(row.retry_after_seconds)
  ) {
    throw new Error("Beta rate-limit storage returned an invalid result");
  }
  return {
    allowed: row.allowed,
    remaining: Math.max(0, row.remaining),
    retryAfterSeconds: Math.max(0, row.retry_after_seconds),
  };
}
