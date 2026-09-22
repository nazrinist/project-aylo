export type RequestHistorySource = "live" | "catalog" | "demo";

export type RequestHistoryStatus =
  | "new"
  | "searched"
  | "failed"
  | "completed"
  | "cancelled"
  | "unknown";

export type RequestHistoryEntry = {
  reference: string;
  originalRequest: string;
  services: string[];
  location: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  requestedDate: string | null;
  timeFrom: string | null;
  timeTo: string | null;
  status: RequestHistoryStatus;
  resultCount: number | null;
  createdAt: string;
};

export type RequestHistoryData = {
  source: RequestHistorySource;
  historyAvailable: boolean;
  scope: "this-browser";
  limit: number;
  entries: RequestHistoryEntry[];
};

export type RequestHistoryApiResponse =
  | ({ ok: true } & RequestHistoryData)
  | { ok: false; code: string; error: string };
