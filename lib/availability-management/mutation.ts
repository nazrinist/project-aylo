import "server-only";

import {
  AvailabilityAccessNotConfiguredError,
  AvailabilityActionsUnavailableError,
  AvailabilityMutationWriteError,
  AvailabilityUnauthorizedError,
  availabilityMutationErrorDetails,
} from "@/lib/availability-management/errors";
import {
  isOperatorAccessConfigured,
  verifyOperatorAuthorization,
} from "@/lib/operator-access";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";
import {
  AvailabilityMutationInputSchema,
  AvailabilityStatusSchema,
  type AvailabilityMutationResult,
  type AvailabilitySlotSummary,
} from "@/types/availability";

type AvailabilityMutationRpcRow = {
  slot_id: string;
  slot_business_id: string;
  slot_service_id: string;
  slot_service_name: string;
  slot_start_time: string;
  slot_end_time: string;
  slot_status: string;
  mutation_changed: boolean;
};

export async function mutateAvailability(
  rawInput: unknown,
  authorization: string | null,
): Promise<AvailabilityMutationResult> {
  if (!isSupabaseAdminConfigured()) {
    throw new AvailabilityActionsUnavailableError();
  }
  if (!isOperatorAccessConfigured()) {
    throw new AvailabilityAccessNotConfiguredError();
  }
  if (!verifyOperatorAuthorization(authorization)) {
    throw new AvailabilityUnauthorizedError();
  }

  const input = AvailabilityMutationInputSchema.parse(rawInput);
  const hasWindow = input.action === "create" || input.action === "update";
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("manage_availability_slot", {
    p_action: input.action,
    p_slot_id: "slotId" in input ? input.slotId : null,
    p_expected_business_id: input.businessId,
    p_service_id: hasWindow ? input.serviceId : null,
    p_start_time: hasWindow ? input.startTime : null,
    p_end_time: hasWindow ? input.endTime : null,
    p_target_status:
      input.action === "set_status" ? input.targetStatus : null,
    p_operator_confirmed: input.confirmed,
  });

  if (error) {
    throw new AvailabilityMutationWriteError(
      availabilityMutationErrorDetails(error.message, error.code),
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | AvailabilityMutationRpcRow
    | null;
  const status = AvailabilityStatusSchema.safeParse(row?.slot_status);
  if (
    !row ||
    !status.success ||
    !row.slot_id ||
    !row.slot_business_id ||
    !row.slot_service_id ||
    !row.slot_service_name ||
    !row.slot_start_time ||
    !row.slot_end_time
  ) {
    throw new AvailabilityMutationWriteError(
      availabilityMutationErrorDetails(
        "Availability mutation RPC returned no valid row",
      ),
    );
  }

  const slot: AvailabilitySlotSummary = {
    id: row.slot_id,
    businessId: row.slot_business_id,
    serviceId: row.slot_service_id,
    serviceName: row.slot_service_name,
    startTime: row.slot_start_time,
    endTime: row.slot_end_time,
    status: status.data,
  };

  return {
    action: input.action,
    changed: row.mutation_changed,
    slot: input.action === "delete" ? null : slot,
  };
}
