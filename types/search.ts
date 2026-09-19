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
  reasons: string[];
};

export type SearchResponse = {
  source: "supabase" | "demo";
  appliedFilters: string[];
  results: SearchResult[];
};
