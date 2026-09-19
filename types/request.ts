import type { Intent } from "@/types/intent";

export type RequestInsert = {
  original_request: string;
  category: Intent["category"];
  services: string[];
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  requested_date: string | null;
  time_from: string | null;
  time_to: string | null;
  status: "new";
};

export type RequestPersistence = {
  status: "saved" | "disabled" | "failed";
  requestId: string | null;
};
