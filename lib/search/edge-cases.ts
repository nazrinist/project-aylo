import type { Intent } from "@/types/intent";
import { requiredMissingFields } from "@/lib/intent/follow-up";

const BAKU_OFFSET_MINUTES = 4 * 60;
const SINGLE_TIME_TOLERANCE_MINUTES = 60;

type DatedTimeWindow = {
  date: string;
  time_from: string | null;
  time_to: string | null;
};

export type SearchEdgeCaseCode =
  | "SEARCH_CATEGORY_UNSUPPORTED"
  | "SEARCH_INTENT_INCOMPLETE"
  | "SEARCH_DATE_PAST"
  | "SEARCH_TIME_PAST";

export class SearchEdgeCaseError extends Error {
  readonly code: SearchEdgeCaseCode;
  readonly status = 422;

  constructor(code: SearchEdgeCaseCode, message: string) {
    super(message);
    this.name = "SearchEdgeCaseError";
    this.code = code;
  }
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function validInstant(value: Date) {
  if (!Number.isFinite(value.getTime())) {
    throw new RangeError("A valid current time is required");
  }
  return value;
}

export function bakuDateTimeParts(value: Date) {
  const instant = validInstant(value);
  const shifted = new Date(
    instant.getTime() + BAKU_OFFSET_MINUTES * 60 * 1000,
  );
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes:
      shifted.getUTCHours() * 60 +
      shifted.getUTCMinutes() +
      shifted.getUTCSeconds() / 60 +
      shifted.getUTCMilliseconds() / 60_000,
  };
}

export function addBakuCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(days) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError("A valid Baku calendar date and whole-day offset are required");
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function isOvernightWindow(
  window: Pick<DatedTimeWindow, "time_from" | "time_to">,
) {
  return Boolean(
    window.time_from &&
    window.time_to &&
    clockMinutes(window.time_from) > clockMinutes(window.time_to),
  );
}

function searchWindowHasPassed(
  window: Pick<DatedTimeWindow, "time_from" | "time_to">,
  currentMinutes: number,
) {
  const from = window.time_from ? clockMinutes(window.time_from) : null;
  const to = window.time_to ? clockMinutes(window.time_to) : null;

  if (from === null && to === null) return false;
  if (from !== null && to === null) {
    return currentMinutes > Math.min(
      from + SINGLE_TIME_TOLERANCE_MINUTES,
      24 * 60 - 1,
    );
  }
  if (from === null && to !== null) return currentMinutes > to;
  if (from === null || to === null) return false;
  if (from > to) return false;
  return currentMinutes > to;
}

export function assertCurrentAvailabilityRequest(
  window: DatedTimeWindow,
  now = new Date(),
) {
  const current = bakuDateTimeParts(now);
  if (window.date < current.date) {
    throw new SearchEdgeCaseError(
      "SEARCH_DATE_PAST",
      "That date has already passed in Baku. Choose today or a future date.",
    );
  }
  if (
    window.date === current.date &&
    searchWindowHasPassed(window, current.minutes)
  ) {
    throw new SearchEdgeCaseError(
      "SEARCH_TIME_PAST",
      "That time window has already passed in Baku. Choose a later time or date.",
    );
  }
}

export function assertCurrentSearchIntent(intent: Intent, now = new Date()) {
  if (intent.category !== "beauty") {
    throw new SearchEdgeCaseError(
      "SEARCH_CATEGORY_UNSUPPORTED",
      "Aylo V1 searches non-medical beauty services only.",
    );
  }

  const missing = requiredMissingFields(intent);
  if (missing.length > 0 || !intent.date) {
    throw new SearchEdgeCaseError(
      "SEARCH_INTENT_INCOMPLETE",
      `Add the missing ${missing.join(", ")} before searching.`,
    );
  }

  assertCurrentAvailabilityRequest({
    date: intent.date,
    time_from: intent.time_from,
    time_to: intent.time_to,
  }, now);
}
