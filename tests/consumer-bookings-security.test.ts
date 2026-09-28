import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("booking status DAL scopes rows to encrypted history ownership", async () => {
  const source = await readFile(
    new URL("../lib/bookings/status-data.ts", import.meta.url),
    "utf8",
  );
  const bookingSelect = source.match(/\.from\("bookings"\)\s*\.select\("([^"]+)"\)/);

  assert.match(source, /import "server-only"/);
  assert.match(source, /readRequestHistoryIds\(historyToken\)/);
  assert.match(source, /\.in\("request_id", requestIds\)/);
  assert.equal(
    bookingSelect?.[1],
    "id,booked_for,price,currency,status,created_at,merchant_responded_at,businesses(name,address),services(name,duration_minutes)",
  );
  assert.doesNotMatch(bookingSelect?.[1] ?? "", /request_id|user_id|original_request/);
});

test("booking status API accepts ownership only from the private cookie", async () => {
  const route = await readFile(
    new URL("../app/api/bookings/route.ts", import.meta.url),
    "utf8",
  );
  const getHandler = route.slice(
    route.indexOf("export async function GET"),
    route.indexOf("export async function POST"),
  );

  assert.match(getHandler, /requireBetaAccess\(request\)/);
  assert.match(getHandler, /request\.cookies\.get\(REQUEST_HISTORY_COOKIE\)/);
  assert.match(getHandler, /searchParams\.size > 0/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Vary: "Cookie"/);
  assert.doesNotMatch(getHandler, /searchParams\.get\(["'](?:id|requestId|bookingId)["']\)/);
  assert.doesNotMatch(getHandler, /request\.json\(\)/);
});

test("consumer booking page refreshes without exposing browser secrets", async () => {
  const page = await readFile(
    new URL("../app/bookings/page.tsx", import.meta.url),
    "utf8",
  );
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const confirmation = await readFile(
    new URL("../app/components/booking-confirmation.tsx", import.meta.url),
    "utf8",
  );
  const history = await readFile(
    new URL("../app/history/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /fetch\("\/api\/bookings", \{ cache: "no-store" \}\)/);
  assert.match(page, /window\.setInterval/);
  assert.match(page, /60_000/);
  assert.match(page, /This browser only/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
  assert.match(home, /href="\/bookings"/);
  assert.match(confirmation, /href="\/bookings"/);
  assert.match(confirmation, /Track booking/);
  assert.match(history, /also hides My bookings/);
});

test("booking status stays outside crawler-visible consumer pages", async () => {
  const robots = await readFile(new URL("../app/robots.ts", import.meta.url), "utf8");
  assert.match(robots, /"\/bookings"/);
});
