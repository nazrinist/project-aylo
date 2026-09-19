import type { FollowUpQuestion, RequiredIntentField } from "@/types/follow-up";
import type { Intent } from "@/types/intent";

const requiredFields: RequiredIntentField[] = ["services", "location", "date"];

const questions: Record<RequiredIntentField, Omit<FollowUpQuestion, "field">> = {
  services: {
    question: "Which beauty service do you need?",
    examples: ["Hair + makeup", "Manicure", "Brows + lashes"],
  },
  location: {
    question: "Which area of Baku should I search?",
    examples: ["Ağ Şəhər", "Xətai", "Nərimanov"],
  },
  date: {
    question: "What day should I search for?",
    examples: ["Today", "Tomorrow", "Day after tomorrow"],
  },
};

export function requiredMissingFields(intent: Intent): RequiredIntentField[] {
  return requiredFields.filter((field) => {
    if (field === "services") return intent.services.length === 0;
    return !intent[field];
  });
}

export function normalizeMissingFields(intent: Intent): Intent {
  return { ...intent, missing_fields: requiredMissingFields(intent) };
}

export function nextFollowUpQuestion(intent: Intent): FollowUpQuestion | null {
  const field = requiredMissingFields(intent)[0];
  return field ? { field, ...questions[field] } : null;
}
