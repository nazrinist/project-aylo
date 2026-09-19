export type RequiredIntentField = "services" | "location" | "date";

export type FollowUpQuestion = {
  field: RequiredIntentField;
  question: string;
  examples: string[];
};
