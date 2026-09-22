import "server-only";

import { requestHistoryEntryFromRow, type RequestHistoryRow } from "@/lib/history/shared";
import { getRequestHistorySecret, readRequestHistoryIds } from "@/lib/history/session";
import { REQUEST_HISTORY_LIMIT } from "@/lib/history/token-core";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { RequestHistoryData } from "@/types/history";

export class RequestHistorySecretMissingError extends Error {
  constructor() {
    super("Request history encryption is not configured");
    this.name = "RequestHistorySecretMissingError";
  }
}

function unavailableHistory(): RequestHistoryData {
  return {
    source: isSupabaseConfigured() ? "catalog" : "demo",
    historyAvailable: false,
    scope: "this-browser",
    limit: REQUEST_HISTORY_LIMIT,
    entries: [],
  };
}

export async function getRequestHistoryData(historyToken: string | undefined): Promise<RequestHistoryData> {
  if (!isSupabaseAdminConfigured()) return unavailableHistory();
  if (!getRequestHistorySecret()) throw new RequestHistorySecretMissingError();
  const requestIds = readRequestHistoryIds(historyToken);
  if (requestIds.length === 0) {
    return { source: "live", historyAvailable: true, scope: "this-browser", limit: REQUEST_HISTORY_LIMIT, entries: [] };
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("requests")
    .select("id,original_request,services,location,budget_min,budget_max,currency,requested_date,time_from,time_to,status,result_count,created_at")
    .in("id", requestIds)
    .order("created_at", { ascending: false })
    .limit(REQUEST_HISTORY_LIMIT);
  if (result.error) throw new Error(result.error.message);

  return {
    source: "live",
    historyAvailable: true,
    scope: "this-browser",
    limit: REQUEST_HISTORY_LIMIT,
    entries: ((result.data ?? []) as RequestHistoryRow[]).map(requestHistoryEntryFromRow),
  };
}
