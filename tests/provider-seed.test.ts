import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BusinessInputSchema } from "../types/business.ts";

const markerStart = "-- Day 28 provider candidates: start";
const markerEnd = "-- Day 28 provider candidates: end";

type CandidateRow = {
  id: string;
  name: string;
  address: string;
  sourceUrl: string;
  sourceCheckedAt: string;
};

async function loadProviderSeed() {
  const seed = await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  const start = seed.indexOf(markerStart);
  const end = seed.indexOf(markerEnd);

  assert.notEqual(start, -1, "Day 28 start marker is missing");
  assert.notEqual(end, -1, "Day 28 end marker is missing");
  assert.ok(end > start, "Day 28 markers are out of order");

  const block = seed.slice(start, end + markerEnd.length);
  const rowPattern = /^\s*\('([0-9a-f-]+)', '([^']+)', 'beauty', '([^']+)', null, null, null, false, '(https:\/\/[^']+)', date '(\d{4}-\d{2}-\d{2})', 'candidate'\),?$/gm;
  const rows: CandidateRow[] = Array.from(block.matchAll(rowPattern), (match) => ({
    id: match[1],
    name: match[2],
    address: match[3],
    sourceUrl: match[4],
    sourceCheckedAt: match[5],
  }));

  return { seed, block, rows };
}

test("Day 28 seed contains 40 unique source-backed Baku candidates", async () => {
  const { block, rows } = await loadProviderSeed();

  assert.equal(rows.length, 40);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  assert.equal(
    new Set(rows.map((row) => `${row.name}\u0000${row.address}`)).size,
    rows.length,
  );
  assert.match(block, /on conflict \(id\) do nothing;/);

  for (const row of rows) {
    assert.match(row.id, /^20000000-0000-4000-8000-\d{12}$/);
    assert.match(row.address, /Bakı$/);
    assert.equal(new URL(row.sourceUrl).hostname, "2gis.az");
    assert.equal(row.sourceCheckedAt, "2026-09-27");
  }
});

test("provider candidates cannot become offers before onboarding", async () => {
  const { seed, block, rows } = await loadProviderSeed();
  const seedWithoutCandidates = seed.replace(block, "");

  for (const row of rows) {
    assert.equal(
      seedWithoutCandidates.includes(row.id),
      false,
      `${row.name} must not have seeded services or availability`,
    );
  }

  assert.doesNotMatch(block, /'onboarded'/);
  assert.doesNotMatch(block, /\btrue\b/);
});

test("provider provenance migration is additive and constrained", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/0010_provider_provenance.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /add column if not exists source_url text/);
  assert.match(sql, /add column if not exists source_checked_at date/);
  assert.match(sql, /add column if not exists onboarding_status text not null default 'sample'/);
  assert.match(sql, /onboarding_status in \('sample', 'candidate', 'onboarded'\)/);
  assert.match(sql, /source_url ~ '\^https:\/\/'/);
  assert.match(sql, /source_checked_at is null or source_url is not null/);
  assert.match(sql, /create index if not exists businesses_onboarding_status_name_idx/);
  assert.doesNotMatch(sql, /\b(drop|truncate|delete)\b/i);
});

test("business management exposes provenance but cannot overwrite it", async () => {
  const [collectionRoute, itemRoute, page] = await Promise.all([
    readFile(new URL("../app/api/businesses/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/businesses/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/businesses/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const field of ["source_url", "source_checked_at", "onboarding_status"]) {
    assert.match(collectionRoute, new RegExp(field));
    assert.match(itemRoute, new RegExp(field));
  }

  assert.equal("source_url" in BusinessInputSchema.shape, false);
  assert.equal("source_checked_at" in BusinessInputSchema.shape, false);
  assert.equal("onboarding_status" in BusinessInputSchema.shape, false);
  assert.match(page, /candidateBadge/);
  assert.match(page, /Public source/);
});
