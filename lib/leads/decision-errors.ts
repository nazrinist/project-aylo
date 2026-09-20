export type LeadDecisionErrorDetails = {
  code: string;
  message: string;
  status: number;
};

const KNOWN_ERRORS: Array<[string, LeadDecisionErrorDetails]> = [
  [
    "CONFIRMATION_REQUIRED",
    {
      code: "CONFIRMATION_REQUIRED",
      message: "Explicit confirmation is required.",
      status: 400,
    },
  ],
  [
    "INVALID_LEAD_DECISION",
    {
      code: "INVALID_LEAD_DECISION",
      message: "Choose accept or reject.",
      status: 400,
    },
  ],
  [
    "LEAD_NOT_FOUND",
    {
      code: "LEAD_NOT_FOUND",
      message: "This lead no longer exists for the selected business.",
      status: 404,
    },
  ],
  [
    "LEAD_ALREADY_DECIDED",
    {
      code: "LEAD_ALREADY_DECIDED",
      message: "This lead already has a different final decision.",
      status: 409,
    },
  ],
  [
    "LEAD_SLOT_CONFLICT",
    {
      code: "LEAD_SLOT_CONFLICT",
      message: "The appointment slot changed. Refresh the inbox before deciding.",
      status: 409,
    },
  ],
  [
    "LEAD_EXPIRED",
    {
      code: "LEAD_EXPIRED",
      message: "A past appointment cannot be accepted.",
      status: 409,
    },
  ],
];

export function leadDecisionErrorDetails(
  message: string,
  databaseCode?: string,
): LeadDecisionErrorDetails {
  const known = KNOWN_ERRORS.find(([marker]) => message.includes(marker));
  if (known) return known[1];

  if (
    databaseCode === "PGRST202" ||
    message.includes("decide_booking_lead")
  ) {
    return {
      code: "LEAD_DECISION_MIGRATION_REQUIRED",
      message: "Run the Day 19 Supabase migration and restart the server.",
      status: 503,
    };
  }

  return {
    code: "LEAD_DECISION_FAILED",
    message: "The lead decision could not be saved. Try again.",
    status: 500,
  };
}

export class LeadDecisionWriteError extends Error {
  readonly details: LeadDecisionErrorDetails;

  constructor(details: LeadDecisionErrorDetails) {
    super(details.message);
    this.name = "LeadDecisionWriteError";
    this.details = details;
  }
}
