import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("agent run DAL is server-only, private and best-effort", async () => {
  const source = await readFile(new URL("../lib/observability/agent-runs.ts", import.meta.url), "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /isSupabaseAdminConfigured/);
  assert.match(source, /\.from\("agent_runs"\)\.insert/);
  assert.match(source, /return "disabled"/);
  assert.match(source, /return "failed"/);
  assert.ok(source.indexOf("if (error) throw error") < source.indexOf("catch (error)"));
  assert.ok(source.indexOf("catch (error)") < source.indexOf('return "failed"'));
});

test("intent and search routes emit trace headers and record both outcomes", async () => {
  const intent = await readFile(new URL("../app/api/intent/route.ts", import.meta.url), "utf8");
  const search = await readFile(new URL("../app/api/search/route.ts", import.meta.url), "utf8");
  for (const route of [intent, search]) {
    assert.match(route, /randomUUID\(\)/);
    assert.match(route, /observabilityHeaders/);
    assert.equal(route.match(/recordAgentRun\(/g)?.length, 2);
  }
  assert.match(intent, /inputTokens: extraction\.inputTokens/);
  assert.match(search, /requestId: savedRequestId/);
});

test("Day 24 migration keeps telemetry private and excludes payload columns", async () => {
  const sql = await readFile(new URL("../supabase/migrations/0009_agent_run_observability.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke all on table public\.agent_runs from anon, authenticated/);
  assert.match(sql, /agent_runs_trace_id_unique_idx/);
  assert.match(sql, /input_tokens is null or input_tokens >= 0/);
  assert.match(sql, /Never stores prompts, request text, cookies, secrets, or model output/);
  assert.doesNotMatch(sql, /add column if not exists (?:prompt|request_text|model_output|cookie|secret)/i);
});
