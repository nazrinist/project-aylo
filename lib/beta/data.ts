import "server-only";

import type { BetaSessionClaims } from "@/lib/beta/token-core";
import type { BetaFeedbackInput } from "@/types/beta";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";

type BetaParticipant = Pick<
  BetaSessionClaims,
  "participantId" | "inviteFingerprint"
>;

export async function registerBetaParticipant(claims: BetaParticipant) {
  if (!isSupabaseAdminConfigured()) return false;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("beta_participants")
    .upsert(
      {
        id: claims.participantId,
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
