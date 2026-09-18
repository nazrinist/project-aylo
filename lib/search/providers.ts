import "server-only";

import type { Intent } from "@/types/intent";
import type { SearchResponse, SearchResult } from "@/types/search";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { searchDemoProviders } from "./demo-providers";
import {
  buildReasons,
  locationMatches,
  matchScore,
  requestedDate,
  serviceCoverage,
  timeDistanceMinutes,
} from "./shared";

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

type RawAvailability = {
  id: string;
  service_id: string;
  start_time: string;
};

export async function searchProviders(intent: Intent): Promise<SearchResponse> {
  if (!isSupabaseConfigured()) {
    return { source: "demo", results: searchDemoProviders(intent) };
  }

  const supabase = getSupabaseServerClient();
  const { data: serviceRows, error: serviceError } = await supabase
    .from("services")
    .select(
      "id,name,price,currency,duration_minutes,business_id,businesses!inner(id,name,address,rating,verified,category)",
    )
    .eq("active", true)
    .eq("businesses.category", "beauty")
    .limit(250);

  if (serviceError) throw new Error(`Provider search failed: ${serviceError.message}`);

  const services = (serviceRows ?? []) as unknown as RawService[];
  const matchingServices = services.filter(
    (service) => serviceCoverage(service.name, intent.services) > 0,
  );
  if (matchingServices.length === 0) return { source: "supabase", results: [] };

  const date = requestedDate(intent);
  const dayStart = `${date}T00:00:00+04:00`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = `${next.toISOString().slice(0, 10)}T00:00:00+04:00`;

  const { data: availabilityRows, error: availabilityError } = await supabase
    .from("availability")
    .select("id,service_id,start_time")
    .in(
      "service_id",
      matchingServices.map((service) => service.id),
    )
    .eq("status", "available")
    .gte("start_time", dayStart)
    .lt("start_time", dayEnd)
    .limit(500);

  if (availabilityError) {
    throw new Error(`Availability search failed: ${availabilityError.message}`);
  }

  const servicesById = new Map(matchingServices.map((service) => [service.id, service]));
  const results = ((availabilityRows ?? []) as RawAvailability[])
    .map((slot): SearchResult | null => {
      const service = servicesById.get(slot.service_id);
      if (!service) return null;
      const business = service.businesses;
      const price = Number(service.price ?? 0);
      const rating = business.rating === null ? null : Number(business.rating);
      const coverage = serviceCoverage(service.name, intent.services);
      const locationMatch = locationMatches(business.address ?? "", intent.location);
      const timeDistance = timeDistanceMinutes(slot.start_time, intent);

      return {
        id: slot.id,
        businessId: business.id,
        businessName: business.name,
        serviceId: service.id,
        serviceName: service.name,
        address: business.address ?? "Bakı",
        price,
        currency: service.currency,
        durationMinutes: service.duration_minutes,
        rating,
        verified: business.verified,
        availableTime: slot.start_time,
        matchScore: matchScore({
          coverage,
          price,
          budgetMax: intent.budget_max,
          timeDistance,
          rating,
          locationMatch,
        }),
        reasons: buildReasons({
          coverage,
          price,
          budgetMax: intent.budget_max,
          timeDistance,
          verified: business.verified,
        }),
      };
    })
    .filter((result): result is SearchResult => Boolean(result))
    .filter((result) => !intent.budget_max || result.price <= intent.budget_max * 1.25)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);

  return { source: "supabase", results };
}
