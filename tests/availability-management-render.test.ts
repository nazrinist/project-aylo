import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("availability page renders a seven-day, four-state management surface", async () => {
  const source = await readFile(
    new URL("../app/availability/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Availability schedule/);
  assert.match(source, /Manage seven days/);
  assert.match(source, /AVAILABILITY_FILTERS\.map/);
  assert.match(source, /Available/);
  assert.match(source, /Held/);
  assert.match(source, /Booked/);
  assert.match(source, /Blocked/);
  assert.match(source, /Booking flow controlled/);
});

test("destructive schedule actions require an accessible final confirmation", async () => {
  const source = await readFile(
    new URL("../app/availability/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /Final confirmation/);
  assert.match(source, /Confirm action/);
  assert.match(source, /confirmed: true/);
});

test("operator token remains in React memory and demo behavior is explicit", async () => {
  const source = await readFile(
    new URL("../app/availability/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useState\(""\)/);
  assert.match(source, /Authorization: `Bearer \$\{operatorToken\.trim\(\)\}`/);
  assert.match(source, /page&apos;s memory/);
  assert.match(source, /Demo changes stay in this page&apos;s memory only/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(source, /document\.cookie/);
});
