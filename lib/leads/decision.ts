import "server-only";

import {
  isLeadAccessConfigured,
  verifyLeadAuthorization,
} from "@/lib/leads/access";
import { verifyLeadActionToken } from "@/lib/leads/action-token";
import {
  leadDecisionErrorDetails,
  LeadDecisionWriteError,
} from "@/lib/leads/decision-errors";
import {
  LeadAccessNotConfiguredError,
  LeadUnauthorizedError,
} from "@/lib/leads/errors";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";
import {
  LeadDecisionSchema,
  type LeadDecisionInput,
  type LeadDecisionResult,
} from "@/types/lead";

type LeadDecisionRpcRow = {
  decision_status: string;
  decision_responded_at: string;
  was_updated: boolean;
};

export class LeadActionsUnavailableError extends Error {
  constructor() {
    super("Live lead actions are unavailable");
    this.name = "LeadActionsUnavailableError";
  }
}

export class LeadActionTokenInvalidError extends Error {
  constructor() {
    super("Lead action token is invalid or expired");
    this.name = "LeadActionTokenInvalidError";
  }
}

export async function decideLead(
  input: LeadDecisionInput,
  authorization: string | null,
): Promise<LeadDecisionResult> {
  if (!isSupabaseAdminConfigured()) throw new LeadActionsUnavailableError();
  if (!isLeadAccessConfigured()) throw new LeadAccessNotConfiguredError();
  if (!verifyLeadAuthorization(authorization)) throw new LeadUnauthorizedError();

  const claims = verifyLeadActionToken(input.actionToken);
  if (!claims || claims.status !== "pending_confirmation") {
    throw new LeadActionTokenInvalidError();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("decide_booking_lead", {
    p_booking_id: claims.bookingId,
    p_expected_business_id: claims.businessId,
    p_target_status: input.decision,
    p_operator_confirmed: input.confirmed,
  });

  if (error) {
    throw new LeadDecisionWriteError(
      leadDecisionErrorDetails(error.message, error.code),
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | LeadDecisionRpcRow
    | null;
  const status = LeadDecisionSchema.safeParse(row?.decision_status);
  if (!row || !status.success || !row.decision_responded_at) {
    throw new LeadDecisionWriteError(
      leadDecisionErrorDetails("Lead decision RPC returned no valid row"),
    );
  }

  return {
    reference: claims.bookingId.slice(0, 8).toUpperCase(),
    status: status.data,
    respondedAt: row.decision_responded_at,
    changed: row.was_updated,
  };
}
