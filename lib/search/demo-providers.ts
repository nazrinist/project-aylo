import type { Intent } from "@/types/intent";
import type { SearchResult } from "@/types/search";
import {
  buildReasons,
  locationMatches,
  matchScore,
  requestedDate,
  serviceCoverage,
  timeDistanceMinutes,
} from "./shared";

const providers = [
  ["Glow Studio", "Ağ Şəhər, Bakı", "Hair + Makeup", 95, 90, 4.9, true],
  ["Luna Beauty Bar", "Ağ Şəhər, Bakı", "Makeup", 70, 60, 4.8, true],
  ["Mira Studio", "Xətai, Bakı", "Hair + Makeup", 110, 105, 4.9, true],
  ["Nail Spot", "Ağ Şəhər, Bakı", "Manicure", 35, 60, 4.7, true],
  ["Aura Beauty", "Nərimanov, Bakı", "Hair + Makeup", 85, 90, 4.6, false],
  ["Soleil Studio", "Səbail, Bakı", "Hair styling", 50, 60, 4.8, true],
  ["Brow Lab", "28 May, Bakı", "Brows + Lashes", 55, 75, 4.9, true],
  ["Velvet Beauty", "Ağ Şəhər, Bakı", "Hair + Makeup", 120, 120, 4.7, true],
  ["Muse Makeup", "İçərişəhər, Bakı", "Makeup", 80, 60, 4.8, false],
  ["Blush Room", "Gənclik, Bakı", "Hair + Makeup", 100, 90, 4.7, true],
  ["Iris Nails", "Xətai, Bakı", "Manicure + Pedicure", 60, 100, 4.6, true],
  ["Nova Beauty House", "Ağ Şəhər, Bakı", "Hair + Makeup", 105, 100, 4.9, true],
] as const;

export function searchDemoProviders(intent: Intent): SearchResult[] {
  const date = requestedDate(intent);
  const [baseHour, baseMinute] = (intent.time_from ?? "18:00").split(":").map(Number);

  return providers
    .map((provider, index) => {
      const [businessName, address, serviceName, price, duration, rating, verified] = provider;
      const coverage = serviceCoverage(serviceName, intent.services);
      const totalMinutes = baseHour * 60 + baseMinute + (index % 3) * 30;
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      const availableTime = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+04:00`;
      const timeDistance = timeDistanceMinutes(availableTime, intent);
      const locationMatch = locationMatches(address, intent.location);
      const score = matchScore({
        coverage,
        price,
        budgetMax: intent.budget_max,
        timeDistance,
        rating,
        locationMatch,
      });

      return {
        id: `demo-${index + 1}`,
        businessId: `demo-business-${index + 1}`,
        businessName,
        serviceId: `demo-service-${index + 1}`,
        serviceName,
        address,
        price,
        currency: "AZN",
        durationMinutes: duration,
        rating,
        verified,
        availableTime,
        matchScore: score,
        reasons: buildReasons({
          coverage,
          price,
          budgetMax: intent.budget_max,
          timeDistance,
          verified,
        }),
      } satisfies SearchResult;
    })
    .filter((result) => {
      const coverage = serviceCoverage(result.serviceName, intent.services);
      const priceOk = !intent.budget_max || result.price <= intent.budget_max * 1.25;
      return coverage > 0 && priceOk;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);
}
