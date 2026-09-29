export type BookingCancellationErrorDetails = {
  code: string;
  message: string;
  status: number;
};

const KNOWN_ERRORS: Array<[string, BookingCancellationErrorDetails]> = [
  [
    "CONFIRMATION_REQUIRED",
    {
      code: "CONFIRMATION_REQUIRED",
      message: "Explicit cancellation confirmation is required.",
      status: 400,
    },
  ],
  [
    "BOOKING_NOT_FOUND",
    {
      code: "BOOKING_CANCELLATION_FORBIDDEN",
      message: "This cancellation action expired or changed. Refresh My bookings.",
      status: 403,
    },
  ],
  [
    "BOOKING_NOT_CANCELLABLE",
    {
      code: "BOOKING_NOT_CANCELLABLE",
      message: "This booking can no longer be cancelled.",
      status: 409,
    },
  ],
  [
    "BOOKING_EXPIRED",
    {
      code: "BOOKING_EXPIRED",
      message: "A past appointment cannot be cancelled.",
      status: 409,
    },
  ],
  [
    "BOOKING_SLOT_CONFLICT",
    {
      code: "BOOKING_SLOT_CONFLICT",
      message: "The appointment changed. Refresh My bookings and try again.",
      status: 409,
    },
  ],
];

export function bookingCancellationErrorDetails(
  message: string,
  databaseCode?: string,
): BookingCancellationErrorDetails {
  const known = KNOWN_ERRORS.find(([marker]) => message.includes(marker));
  if (known) return known[1];

  if (
    databaseCode === "PGRST202" ||
    message.includes("cancel_consumer_booking")
  ) {
    return {
      code: "BOOKING_CANCELLATION_MIGRATION_REQUIRED",
      message: "Run the Day 32 Supabase migration and restart the server.",
      status: 503,
    };
  }

  return {
    code: "BOOKING_CANCELLATION_FAILED",
    message: "The booking could not be cancelled. Try again.",
    status: 500,
  };
}

export class BookingCancellationWriteError extends Error {
  readonly details: BookingCancellationErrorDetails;

  constructor(details: BookingCancellationErrorDetails) {
    super(details.message);
    this.name = "BookingCancellationWriteError";
    this.details = details;
  }
}
