export class AnalyticsAccessNotConfiguredError extends Error {
  constructor() {
    super("Analytics access is not configured");
    this.name = "AnalyticsAccessNotConfiguredError";
  }
}

export class AnalyticsUnauthorizedError extends Error {
  constructor() {
    super("Analytics operator access is required");
    this.name = "AnalyticsUnauthorizedError";
  }
}

export class AnalyticsBusinessNotFoundError extends Error {
  constructor() {
    super("Business not found");
    this.name = "AnalyticsBusinessNotFoundError";
  }
}

export class AnalyticsPrerequisiteMissingError extends Error {
  constructor() {
    super("Analytics prerequisites are missing");
    this.name = "AnalyticsPrerequisiteMissingError";
  }
}
