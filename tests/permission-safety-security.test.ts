import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("business and service mutations require operator authorization before parsing", async () => {
  const paths = [
    "../app/api/businesses/route.ts",
    "../app/api/businesses/[id]/route.ts",
    "../app/api/services/route.ts",
    "../app/api/services/[id]/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /requireOperatorAuthorization/);
    assert.match(source, /if \(accessError\) return accessError/);
    assert.ok(source.indexOf("requireOperatorAuthorization") < source.lastIndexOf(".parse("));
  }
});

test("shared operator response is server-only and constant-time authorization remains centralized", async () => {
  const response = await readFile(new URL("../lib/operator-response.ts", import.meta.url), "utf8");
  const access = await readFile(new URL("../lib/operator-access.ts", import.meta.url), "utf8");
  assert.match(response, /import "server-only"/);
  assert.match(response, /verifyOperatorAuthorization/);
  assert.match(response, /WWW-Authenticate/);
  assert.match(response, /private, no-store/);
  assert.match(access, /timingSafeEqual/);
  assert.match(access, /MINIMUM_OPERATOR_TOKEN_LENGTH = 32/);
});

test("catalog pages keep the operator token only in React memory", async () => {
  for (const path of ["../app/businesses/page.tsx", "../app/services/page.tsx"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /Authorization: `Bearer \$\{operatorToken\.trim\(\)\}`/);
    assert.match(source, /type="password"/);
    assert.match(source, /Read-only/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  }
});

test("intent and search apply the same deterministic safety boundary", async () => {
  const intent = await readFile(new URL("../app/api/intent/route.ts", import.meta.url), "utf8");
  const search = await readFile(new URL("../app/api/search/route.ts", import.meta.url), "utf8");
  assert.match(intent, /assertSafeRequest\(body\.request\)/);
  assert.match(search, /assertSafeRequest\(intent\.original_request\)/);
  assert.match(intent, /REQUEST_REQUIRES_SPECIALIST|RequestSafetyError/);
  assert.match(search, /RequestSafetyError/);
  assert.doesNotMatch(intent, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(search, /error instanceof Error \? error\.message/);
});
