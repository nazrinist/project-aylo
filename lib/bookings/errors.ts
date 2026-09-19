export type BookingErrorDetails = {
  code: string;
  message: string;
  status: number;
};

const KNOWN_ERRORS: Array<[string, BookingErrorDetails]> = [
  [
    "CONFIRMATION_REQUIRED",
    { code: "CONFIRMATION_REQUIRED", message: "Explicit confirmation is required", status: 400 },
  ],
  [
    "REQUEST_NOT_READY",
    { code: "REQUEST_NOT_READY", message: "This search request cannot create a booking", status: 409 },
  ],
  [
    "REQUEST_ALREADY_BOOKED",
    { code: "REQUEST_ALREADY_BOOKED", message: "This request already has a booking", status: 409 },
  ],
  [
    "SLOT_NOT_FOUND",
    { code: "SLOT_NOT_FOUND", message: "This appointment time no longer exists", status: 404 },
  ],
  [
    "SLOT_UNAVAILABLE",
    { code: "SLOT_UNAVAILABLE", message: "This appointment time is no longer available", status: 409 },
  ],
  [
    "SLOT_EXPIRED",
    { code: "SLOT_EXPIRED", message: "This appointment time has already passed", status: 409 },
  ],
  [
    "OFFER_CHANGED",
    { code: "OFFER_CHANGED", message: "The offer changed. Run the search again before booking", status: 409 },
  ],
  [
    "SERVICE_UNAVAILABLE",
    { code: "SERVICE_UNAVAILABLE", message: "This service is no longer available", status: 409 },
  ],
];

export function bookingErrorDetails(message: string, databaseCode?: string) {
  const known = KNOWN_ERRORS.find(([marker]) => message.includes(marker));
  if (known) return known[1];

  if (
    databaseCode === "PGRST202"
    || message.includes("create_booking_from_confirmation")
  ) {
    return {
      code: "BOOKING_MIGRATION_REQUIRED",
      message: "Run the Day 16 Supabase migration and restart the server",
      status: 503,
    } satisfies BookingErrorDetails;
  }

  if (databaseCode === "23505") {
    return {
      code: "SLOT_UNAVAILABLE",
      message: "This appointment time is no longer available",
      status: 409,
    } satisfies BookingErrorDetails;
  }

  return {
    code: "BOOKING_FAILED",
    message: "The booking could not be created. Please try again",
    status: 500,
  } satisfies BookingErrorDetails;
}

export class BookingWriteError extends Error {
  readonly details: BookingErrorDetails;

  constructor(details: BookingErrorDetails) {
    super(details.message);
    this.name = "BookingWriteError";
    this.details = details;
  }
}
