import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_PROVIDER_CATALOG } from "../lib/search/demo-catalog.ts";
import {
  SEARCH_PROVIDERS_TOOL,
  SearchProvidersToolInputSchema,
} from "../lib/tools/search-providers-contract.ts";
import { filterProviderCandidates } from "../lib/tools/search-providers-shared.ts";

const baseInput = {
  category: "beauty" as const,
  services: ["hair", "makeup"],
  location: "Ağ Şəhər, Bakı",
  budget_min: null,
  budget_max: 120,
  currency: "azn",
  limit: 20,
};

test("searchProviders has a strict OpenAI function-tool contract", () => {
  assert.equal(SEARCH_PROVIDERS_TOOL.type, "function");
  assert.equal(SEARCH_PROVIDERS_TOOL.name, "searchProviders");
  assert.equal(SEARCH_PROVIDERS_TOOL.strict, true);
  assert.equal(SEARCH_PROVIDERS_TOOL.parameters.additionalProperties, false);
  assert.deepEqual(SEARCH_PROVIDERS_TOOL.parameters.required, [
    "category",
    "services",
    "location",
    "budget_min",
    "budget_max",
    "currency",
    "limit",
  ]);
});

test("tool input is normalized and invalid budget ranges are rejected", () => {
  assert.equal(SearchProvidersToolInputSchema.parse(baseInput).currency, "AZN");
  assert.equal(
    SearchProvidersToolInputSchema.safeParse({
      ...baseInput,
      budget_min: 121,
      budget_max: 120,
    }).success,
    false,
  );
  assert.equal(
    SearchProvidersToolInputSchema.safeParse({ ...baseInput, limit: 251 }).success,
    false,
  );
  assert.equal(
    SearchProvidersToolInputSchema.safeParse({ ...baseInput, unexpected: true }).success,
    false,
  );
});

test("provider candidates satisfy every deterministic constraint", () => {
  const input = SearchProvidersToolInputSchema.parse(baseInput);
  const providers = filterProviderCandidates(DEMO_PROVIDER_CATALOG, input);

  assert.deepEqual(
    providers.map((provider) => provider.businessName),
    ["Glow Studio", "Nova Beauty House", "Velvet Beauty"],
  );
  assert.ok(
    providers.every(
      (provider) =>
        provider.address === "Ağ Şəhər, Bakı" &&
        provider.price <= 120 &&
        provider.currency === "AZN",
    ),
  );
});

test("provider ordering is stable and respects the requested limit", () => {
  const input = SearchProvidersToolInputSchema.parse({ ...baseInput, limit: 2 });
  const providers = filterProviderCandidates(
    [...DEMO_PROVIDER_CATALOG].reverse(),
    input,
  );

  assert.deepEqual(
    providers.map((provider) => provider.businessName),
    ["Glow Studio", "Nova Beauty House"],
  );
});

test("unsupported categories return no provider candidates", () => {
  const input = SearchProvidersToolInputSchema.parse({
    ...baseInput,
    category: "unknown",
  });
  assert.deepEqual(filterProviderCandidates(DEMO_PROVIDER_CATALOG, input), []);
});
