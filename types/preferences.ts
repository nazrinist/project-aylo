import { z } from "zod";

export const SearchPreferencesSchema = z
  .object({
    location: z.string().trim().min(2).max(120).nullable(),
    budgetMax: z.number().finite().positive().max(1_000_000).nullable(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
  })
  .strict();

export type SearchPreferences = z.infer<typeof SearchPreferencesSchema>;
export type AppliedPreference = "location" | "budget_max";

export type PreferencesData = {
  configured: boolean;
  preferences: SearchPreferences;
};

export type PreferencesApiResponse =
  | ({ ok: true } & PreferencesData)
  | { ok: false; code: string; error: string };

export const EMPTY_SEARCH_PREFERENCES: SearchPreferences = {
  location: null,
  budgetMax: null,
  currency: "AZN",
};
