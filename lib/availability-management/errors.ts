export class AvailabilityAccessNotConfiguredError extends Error {
  constructor() {
    super("Availability access is not configured");
    this.name = "AvailabilityAccessNotConfiguredError";
  }
}

export class AvailabilityUnauthorizedError extends Error {
  constructor() {
    super("Availability operator access is required");
    this.name = "AvailabilityUnauthorizedError";
  }
}

export class AvailabilityBusinessNotFoundError extends Error {
  constructor() {
    super("Business not found");
    this.name = "AvailabilityBusinessNotFoundError";
  }
}

export class AvailabilityServiceNotFoundError extends Error {
  constructor() {
    super("Service not found for this business");
    this.name = "AvailabilityServiceNotFoundError";
  }
}

export class AvailabilityActionsUnavailableError extends Error {
  constructor() {
    super("Live availability actions are unavailable");
    this.name = "AvailabilityActionsUnavailableError";
  }
}

export type AvailabilityMutationErrorDetails = {
  code: string;
  message: string;
  status: number;
};

const KNOWN_ERRORS: Array<[string, AvailabilityMutationErrorDetails]> = [
  [
    "CONFIRMATION_REQUIRED",
    {
      code: "CONFIRMATION_REQUIRED",
      message: "Explicit operator confirmation is required.",
      status: 400,
    },
  ],
  [
    "INVALID_AVAILABILITY_ACTION",
    {
      code: "INVALID_AVAILABILITY_ACTION",
      message: "Choose a supported availability action.",
      status: 400,
    },
  ],
  [
    "INVALID_SLOT_WINDOW",
    {
      code: "INVALID_SLOT_WINDOW",
      message: "Use a future slot between one minute and twelve hours.",
      status: 400,
    },
  ],
  [
    "SERVICE_NOT_FOUND",
    {
      code: "SERVICE_NOT_FOUND",
      message: "Choose an active service belonging to this business.",
      status: 404,
    },
  ],
  [
    "SLOT_NOT_FOUND",
    {
      code: "SLOT_NOT_FOUND",
      message: "This slot no longer exists for the selected business.",
      status: 404,
    },
  ],
  [
    "SLOT_PROTECTED",
    {
      code: "SLOT_PROTECTED",
      message: "Held or booked slots cannot be changed from availability management.",
      status: 409,
    },
  ],
  [
    "SLOT_EXPIRED",
    {
      code: "SLOT_EXPIRED",
      message: "Past slots cannot be changed from this schedule.",
      status: 409,
    },
  ],
  [
    "SLOT_OVERLAP",
    {
      code: "SLOT_OVERLAP",
      message: "This service already has an overlapping active slot.",
      status: 409,
    },
  ],
];

export function availabilityMutationErrorDetails(
  message: string,
  databaseCode?: string,
): AvailabilityMutationErrorDetails {
  const known = KNOWN_ERRORS.find(([marker]) => message.includes(marker));
  if (known) return known[1];

  if (databaseCode === "23P01") {
    return KNOWN_ERRORS.find(([marker]) => marker === "SLOT_OVERLAP")![1];
  }

  if (
    databaseCode === "PGRST202" ||
    message.includes("manage_availability_slot")
  ) {
    return {
      code: "AVAILABILITY_MIGRATION_REQUIRED",
      message: "Run the Day 20 Supabase migration and restart the server.",
      status: 503,
    };
  }

  return {
    code: "AVAILABILITY_MUTATION_FAILED",
    message: "The availability change could not be saved. Refresh and try again.",
    status: 500,
  };
}

export class AvailabilityMutationWriteError extends Error {
  readonly details: AvailabilityMutationErrorDetails;

  constructor(details: AvailabilityMutationErrorDetails) {
    super(details.message);
    this.name = "AvailabilityMutationWriteError";
    this.details = details;
  }
}
