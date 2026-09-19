export type ProviderCandidate = {
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
};

export type ProviderSearchSource = "supabase" | "demo";

export type SearchProvidersToolResult = {
  source: ProviderSearchSource;
  providers: ProviderCandidate[];
};
