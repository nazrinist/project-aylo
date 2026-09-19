import type { Intent } from "@/types/intent";

type ProviderFilterIntent = Pick<
  Intent,
  "category" | "services" | "location" | "budget_min" | "budget_max" | "currency"
>;

type DateIntent = Pick<Intent, "date">;
type TimeIntent = Pick<Intent, "time_from" | "time_to">;

export const SINGLE_TIME_TOLERANCE_MINUTES = 60;

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

export function requestedDate(intent: DateIntent) {
  if (intent.date) return intent.date;
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function requestedMinutes(intent: Pick<TimeIntent, "time_from">) {
  if (!intent.time_from) return null;
  const [hours, minutes] = intent.time_from.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeDistanceMinutes(iso: string, intent: Pick<TimeIntent, "time_from">) {
  const wanted = requestedMinutes(intent);
  if (wanted === null) return 0;
  const date = new Date(iso);
  const available = date.getUTCHours() * 60 + date.getUTCMinutes() + 4 * 60;
  const directDistance = Math.abs((available % (24 * 60)) - wanted);
  return Math.min(directDistance, 24 * 60 - directDistance);
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function slotMinutesInBaku(iso: string) {
  const date = new Date(iso);
  return (date.getUTCHours() * 60 + date.getUTCMinutes() + 4 * 60) % (24 * 60);
}

export function timeMatches(iso: string, intent: TimeIntent) {
  const slotMinutes = slotMinutesInBaku(iso);
  const from = intent.time_from ? clockMinutes(intent.time_from) : null;
  const to = intent.time_to ? clockMinutes(intent.time_to) : null;

  if (from === null && to === null) return true;
  if (from !== null && to === null) {
    const directDistance = Math.abs(slotMinutes - from);
    const circularDistance = Math.min(directDistance, 24 * 60 - directDistance);
    return circularDistance <= SINGLE_TIME_TOLERANCE_MINUTES;
  }
  if (from === null && to !== null) return slotMinutes <= to;
  if (from === null || to === null) return true;
  if (from <= to) return slotMinutes >= from && slotMinutes <= to;
  return slotMinutes >= from || slotMinutes <= to;
}

export function serviceMatchesFilters(
  candidate: {
    serviceName: string;
    address: string;
    price: number;
    currency: string;
  },
  intent: ProviderFilterIntent,
) {
  if (intent.category !== "beauty") return false;
  if (serviceCoverage(candidate.serviceName, intent.services) < 1) return false;
  if (!locationMatches(candidate.address, intent.location)) return false;
  if (candidate.currency.toUpperCase() !== intent.currency.toUpperCase()) return false;
  if (intent.budget_min !== null && candidate.price < intent.budget_min) return false;
  if (intent.budget_max !== null && candidate.price > intent.budget_max) return false;
  return true;
}

export function resultMatchesFilters(
  candidate: {
    serviceName: string;
    address: string;
    price: number;
    currency: string;
    availableTime: string;
  },
  intent: Intent,
) {
  return serviceMatchesFilters(candidate, intent) && timeMatches(candidate.availableTime, intent);
}

export function appliedFilters(intent: Intent) {
  const filters: string[] = [];
  if (intent.services.length > 0) filters.push(intent.services.join(" + "));
  if (intent.location) filters.push(intent.location);
  filters.push(requestedDate(intent));
  if (intent.time_from && intent.time_to) {
    filters.push(`${intent.time_from}–${intent.time_to}`);
  } else if (intent.time_from) {
    filters.push(`${intent.time_from} ± ${SINGLE_TIME_TOLERANCE_MINUTES} min`);
  } else if (intent.time_to) {
    filters.push(`Until ${intent.time_to}`);
  }
  if (intent.budget_min !== null && intent.budget_max !== null) {
    filters.push(`${intent.budget_min}–${intent.budget_max} ${intent.currency}`);
  } else if (intent.budget_min !== null) {
    filters.push(`From ${intent.budget_min} ${intent.currency}`);
  } else if (intent.budget_max !== null) {
    filters.push(`Up to ${intent.budget_max} ${intent.currency}`);
  }
  return filters;
}
