import type { RequestPersistence } from "@/types/request";

export type RankingWeights = {
  service: number;
  time: number;
  budget: number;
  rating: number;
  location: number;
  verified: number;
};

export type RankingScoreBreakdown = RankingWeights & {
  total: number;
};

export type RankingMetadata = {
  version: "v1";
  weights: RankingWeights;
};

export type SearchResult = {
  id: string;
  businessId: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  address: string;
  price: number;
  currency: string;
  durationMinutes: number | null;
  rating: number | null;
  verified: boolean;
  availableTime: string;
  matchScore: number;
  scoreBreakdown: RankingScoreBreakdown;
  reasons: string[];
};

export type BookableSearchResult = SearchResult & {
  bookingToken: string | null;
};

export type RankableSearchResult = Omit<
  SearchResult,
  "matchScore" | "scoreBreakdown" | "reasons"
>;

export type SearchData = {
  source: "supabase" | "demo";
  appliedFilters: string[];
  ranking: RankingMetadata;
  results: SearchResult[];
};

export type SearchResponse = Omit<SearchData, "results"> & {
  results: BookableSearchResult[];
  requestPersistence: RequestPersistence;
};
