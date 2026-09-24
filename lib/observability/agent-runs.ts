import "server-only";

import type { AgentRunRecord } from "@/types/observability";
import { agentRunInsert } from "@/lib/observability/shared";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/server";

export async function recordAgentRun(run: AgentRunRecord) {
  if (!isSupabaseAdminConfigured()) return "disabled" as const;

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("agent_runs").insert(agentRunInsert(run));
    if (error) throw error;
    return "saved" as const;
  } catch (error) {
    console.error(
      "Agent run persistence failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return "failed" as const;
  }
}
