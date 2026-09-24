export type RequestSafetyCode =
  | "REQUEST_REQUIRES_SPECIALIST"
  | "REQUEST_INSTRUCTION_ATTACK";

export type RequestSafetyDecision =
  | { allowed: true; code: null; message: null }
  | { allowed: false; code: RequestSafetyCode; message: string };
