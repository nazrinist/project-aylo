import type {
  RequestSafetyCode,
  RequestSafetyDecision,
} from "@/types/safety";

const invasiveOrMedical = [
  /(?<![\p{L}\p{N}_])(?:botox|botoks|filler|dolğu\p{L}*|dolgu\p{L}*)(?![\p{L}\p{N}_])/iu,
  /(?<![\p{L}\p{N}_])(?:inject(?:ion)?|inyeksiya|iynə|igne)(?![\p{L}\p{N}_])/iu,
  /(?<![\p{L}\p{N}_])(?:surgery|cərrahiyyə|cerrahi|əməliyyat|ameliyat)(?![\p{L}\p{N}_])/iu,
  /(?<![\p{L}\p{N}_])(?:anesthe(?:sia|tic)|anesteziya|narkoz)(?![\p{L}\p{N}_])/iu,
  /(?<![\p{L}\p{N}_])(?:prescription|resept|diaqnoz|diagnos(?:is|e)?)(?![\p{L}\p{N}_])/iu,
];

const instructionAttack = [
  /ignore (?:all |the )?(?:previous|prior|system) instructions?/iu,
  /(?:reveal|show|print|return).{0,24}(?:system prompt|api key|secret|environment variables?)/iu,
  /(?:system prompt|api key|secret).{0,24}(?:reveal|show|print|return)/iu,
  /(?:təlimatları|təlimatları?na).{0,20}(?:məhəl qoyma|ignore)/iu,
];

export function evaluateRequestSafety(request: string): RequestSafetyDecision {
  const normalized = request.normalize("NFKC").trim().toLocaleLowerCase("az");

  if (instructionAttack.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      code: "REQUEST_INSTRUCTION_ATTACK",
      message: "This request cannot be processed. Describe only the beauty service you want to find.",
    };
  }

  if (invasiveOrMedical.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      code: "REQUEST_REQUIRES_SPECIALIST",
      message: "Aylo V1 supports non-medical beauty services only. Contact a qualified licensed professional for medical or invasive procedures.",
    };
  }

  return { allowed: true, code: null, message: null };
}

export class RequestSafetyError extends Error {
  readonly code: RequestSafetyCode;

  constructor(decision: Extract<RequestSafetyDecision, { allowed: false }>) {
    super(decision.message);
    this.name = "RequestSafetyError";
    this.code = decision.code;
  }
}

export function assertSafeRequest(request: string) {
  const decision = evaluateRequestSafety(request);
  if (!decision.allowed) throw new RequestSafetyError(decision);
}
