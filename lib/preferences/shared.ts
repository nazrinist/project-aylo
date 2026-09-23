import type { Intent } from "@/types/intent";
import type {
  AppliedPreference,
  SearchPreferences,
} from "@/types/preferences";
import { normalizeMissingFields } from "@/lib/intent/follow-up";

export function applySearchPreferences(
  intent: Intent,
  preferences: SearchPreferences,
): { intent: Intent; appliedPreferences: AppliedPreference[] } {
  const appliedPreferences: AppliedPreference[] = [];
  let merged = intent;

  if (!intent.location && preferences.location) {
    merged = { ...merged, location: preferences.location };
    appliedPreferences.push("location");
  }

  if (
    intent.budget_min === null &&
    intent.budget_max === null &&
    preferences.budgetMax !== null
  ) {
    merged = {
      ...merged,
      budget_max: preferences.budgetMax,
      currency: preferences.currency,
    };
    appliedPreferences.push("budget_max");
  }

  return {
    intent: normalizeMissingFields(merged),
    appliedPreferences,
  };
}
