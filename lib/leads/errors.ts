export class LeadAccessNotConfiguredError extends Error {
  constructor() {
    super("Lead access is not configured");
    this.name = "LeadAccessNotConfiguredError";
  }
}

export class LeadUnauthorizedError extends Error {
  constructor() {
    super("Lead access is required");
    this.name = "LeadUnauthorizedError";
  }
}

export class LeadBusinessNotFoundError extends Error {
  constructor() {
    super("Business not found");
    this.name = "LeadBusinessNotFoundError";
  }
}
