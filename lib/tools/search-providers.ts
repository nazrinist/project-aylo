import "server-only";

import type { ProviderCandidate, SearchProvidersToolResult } from "@/types/provider";
import { DEMO_PROVIDER_CATALOG } from "@/lib/search/demo-catalog";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  SearchProvidersToolInputSchema,
} from "./search-providers-contract";
import { filterProviderCandidates } from "./search-providers-shared";

type RawService = {
  id: string;
  name: string;
  price: number | string | null;
  currency: string;
  duration_minutes: number | null;
  business_id: string;
  businesses: {
    id: string;
    name: string;
    address: string | null;
    rating: number | string | null;
    verified: boolean;
  };
};

function toProviderCandidate(service: RawService): ProviderCandidate | null {
  if (service.price === null) return null;
  return {
    businessId: service.businesses.id,
    businessName: service.businesses.name,
    serviceId: service.id,
    serviceName: service.name,
    address: service.businesses.address ?? "Bakı",
    price: Number(service.price),
    currency: service.currency,
    durationMinutes: service.duration_minutes,
    rating: service.businesses.rating === null ? null : Number(service.businesses.rating),
    verified: service.businesses.verified,
  };
}

export async function executeSearchProvidersTool(
  rawInput: unknown,
): Promise<SearchProvidersToolResult> {
  const input = SearchProvidersToolInputSchema.parse(rawInput);

  if (!isSupabaseConfigured()) {
    return {
      source: "demo",
      providers: filterProviderCandidates(DEMO_PROVIDER_CATALOG, input),
    };
  }

  if (input.category !== "beauty") {
    return { source: "supabase", providers: [] };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select(
      "id,name,price,currency,duration_minutes,business_id,businesses!inner(id,name,address,rating,verified,category)",
    )
    .eq("active", true)
    .eq("businesses.category", "beauty")
    .limit(250);

  if (error) throw new Error(`Provider search failed: ${error.message}`);

  const candidates = ((data ?? []) as unknown as RawService[])
    .map(toProviderCandidate)
    .filter((candidate): candidate is ProviderCandidate => candidate !== null);

  return {
    source: "supabase",
    providers: filterProviderCandidates(candidates, input),
  };
}
