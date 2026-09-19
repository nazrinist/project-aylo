import "server-only";

import type { Intent } from "@/types/intent";
import type { RequestPersistence } from "@/types/request";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";
import { requestInsertFromIntent } from "./shared";

export async function createSearchRequest(intent: Intent): Promise<RequestPersistence> {
  if (!isSupabaseAdminConfigured()) {
    return { status: "disabled", requestId: null };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("requests")
      .insert(requestInsertFromIntent(intent))
      .select("id")
      .single();

    if (error) throw error;
    return { status: "saved", requestId: data.id };
  } catch (error) {
    console.error(
      "Request persistence failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return { status: "failed", requestId: null };
  }
}

export async function finishSearchRequest(
  requestId: string,
  status: "searched" | "failed",
  resultCount?: number,
) {
  try {
    const supabase = getSupabaseAdminClient();
    const updates =
      status === "searched"
        ? {
            status,
            result_count: resultCount ?? 0,
            searched_at: new Date().toISOString(),
          }
        : { status };
    const { error } = await supabase.from("requests").update(updates).eq("id", requestId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(
      "Request status update failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return false;
  }
}
