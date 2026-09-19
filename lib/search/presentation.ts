import type {
  RankingScoreBreakdown,
  RankingWeights,
} from "@/types/search";

const FACTOR_LABELS: Record<keyof RankingWeights, string> = {
  service: "Service match",
  time: "Time fit",
  budget: "Budget fit",
  rating: "Provider rating",
  location: "Location",
  verified: "Verified status",
};

const FACTOR_KEYS = [
  "service",
  "time",
  "budget",
  "rating",
  "location",
  "verified",
] as const satisfies ReadonlyArray<keyof RankingWeights>;

export function matchLabel(score: number) {
  if (score >= 95) return "Excellent match";
  if (score >= 90) return "Great match";
  if (score >= 80) return "Strong match";
  return "Good match";
}

export function providerInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase("az") ?? "")
    .join("") || "AY";
}

export function formatDuration(minutes: number | null) {
  if (minutes === null) return "Flexible";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

export function scoreFactors(
  breakdown: RankingScoreBreakdown,
  weights: RankingWeights,
) {
  return FACTOR_KEYS.map((key) => {
    const score = breakdown[key];
    const maximum = weights[key];
    const percentage = maximum <= 0
      ? 0
      : Math.round(Math.min(1, Math.max(0, score / maximum)) * 100);
    return { key, label: FACTOR_LABELS[key], score, maximum, percentage };
  });
}
