import { z } from "zod";

export const BetaAccessInputSchema = z
  .object({
    code: z.string().trim().min(16).max(128),
  })
  .strict();

export const BetaFeedbackOutcomeSchema = z.enum([
  "booking_created",
  "useful_options",
  "no_match",
  "technical_issue",
]);

export const BetaFeedbackInputSchema = z
  .object({
    outcome: BetaFeedbackOutcomeSchema,
    easeRating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict()
  .transform((input) => ({
    ...input,
    comment: input.comment || null,
  }));

export type BetaFeedbackInput = z.infer<typeof BetaFeedbackInputSchema>;
export type BetaFeedbackOutcome = z.infer<typeof BetaFeedbackOutcomeSchema>;
