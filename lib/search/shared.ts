import type { Intent } from "@/types/intent";

const aliases: Record<string, string[]> = {
  hair: ["hair", "saç", "sac", "styling", "fen"],
  makeup: ["makeup", "makiyaj", "make-up"],
  nails: ["nail", "nails", "manicure", "manikür", "manikur", "pedicure", "pedikür"],
  lashes: ["lash", "lashes", "kirpik"],
  brows: ["brow", "brows", "qaş", "qas"],
};

function fold(value: string) {
  return value
    .toLocaleLowerCase("az")
    .replaceAll("ə", "e")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u");
}

export function canonicalService(value: string) {
  const normalized = fold(value);
  for (const [canonical, words] of Object.entries(aliases)) {
    if (words.some((word) => normalized.includes(fold(word)))) return canonical;
  }
  return normalized;
}

export function serviceCoverage(serviceName: string, requested: string[]) {
  if (requested.length === 0) return 1;
  const normalizedName = fold(serviceName);
  const matches = requested.filter((service) => {
    const canonical = canonicalService(service);
    const words = aliases[canonical] ?? [canonical];
    return words.some((word) => normalizedName.includes(fold(word)));
  });
  return matches.length / requested.length;
}

export function locationMatches(address: string, requested: string | null) {
  if (!requested) return true;
  const wanted = fold(requested)
    .replaceAll("white city", "ag seher")
    .replaceAll("baku", "")
    .trim();
  const actual = fold(address).replaceAll("white city", "ag seher");
  return !wanted || actual.includes(wanted) || wanted.includes(actual);
}

export function requestedDate(intent: Intent) {
  return intent.date ?? new Date().toISOString().slice(0, 10);
}

export function requestedMinutes(intent: Intent) {
  if (!intent.time_from) return null;
  const [hours, minutes] = intent.time_from.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeDistanceMinutes(iso: string, intent: Intent) {
  const wanted = requestedMinutes(intent);
  if (wanted === null) return 0;
  const date = new Date(iso);
  const available = date.getUTCHours() * 60 + date.getUTCMinutes() + 4 * 60;
  return Math.abs((available % (24 * 60)) - wanted);
}

export function buildReasons(input: {
  coverage: number;
  price: number;
  budgetMax: number | null;
  timeDistance: number;
  verified: boolean;
}) {
  const reasons: string[] = [];
  if (input.coverage === 1) reasons.push("Requested services match");
  if (input.budgetMax && input.price <= input.budgetMax) reasons.push("Within budget");
  if (input.timeDistance <= 60) reasons.push("Close to your preferred time");
  if (input.verified) reasons.push("Verified provider");
  return reasons.slice(0, 3);
}

export function matchScore(input: {
  coverage: number;
  price: number;
  budgetMax: number | null;
  timeDistance: number;
  rating: number | null;
  locationMatch: boolean;
}) {
  const service = input.coverage * 40;
  const time = Math.max(0, 25 - input.timeDistance / 12);
  const budget = !input.budgetMax
    ? 15
    : input.price <= input.budgetMax
      ? 15
      : Math.max(0, 15 - ((input.price - input.budgetMax) / input.budgetMax) * 30);
  const rating = ((input.rating ?? 4) / 5) * 10;
  const location = input.locationMatch ? 10 : 2;
  return Math.round((service + time + budget + rating + location) * 10) / 10;
}
