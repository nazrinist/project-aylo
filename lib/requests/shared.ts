import type { Intent } from "@/types/intent";
import type { RequestInsert } from "@/types/request";

export function requestInsertFromIntent(intent: Intent): RequestInsert {
  return {
    original_request: intent.original_request,
    category: intent.category,
    services: intent.services,
    location: intent.location,
    budget_min: intent.budget_min,
    budget_max: intent.budget_max,
    currency: intent.currency,
    requested_date: intent.date,
    time_from: intent.time_from,
    time_to: intent.time_to,
    status: "new",
  };
}
