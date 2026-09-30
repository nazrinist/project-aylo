import assert from "node:assert/strict";
import test from "node:test";
import {
  consumerBookingCanExportCalendar,
  createConsumerBookingCalendar,
} from "../lib/bookings/calendar.ts";
import type { ConsumerBooking } from "../types/booking.ts";

const now = Date.parse("2026-10-01T08:00:00Z");
const booking: ConsumerBooking = {
  reference: "40000000",
  businessName: "Gözəllik, Bakı; Studio\\North".repeat(4),
  serviceName: "Hair\r\nBEGIN:VEVENT",
  address: "Ağ Şəhər, Bakı",
  bookedFor: "2026-10-02T23:30:00+04:00",
  bookedUntil: "2026-10-03T01:00:00+04:00",
  durationMinutes: 60,
  price: 95,
  currency: "AZN",
  status: "accepted",
  createdAt: "2026-09-29T08:00:00.000Z",
  merchantRespondedAt: "2026-09-29T10:00:00.000Z",
  cancellationToken: "secret-cancellation-token",
  rescheduleToken: "secret-reschedule-token",
};

test("calendar uses exact booked slot bounds across Baku midnight", () => {
  const ics = createConsumerBookingCalendar(booking, now);
  assert.ok(ics);
  const unfolded = ics.replace(/\r\n /g, "");

  assert.match(unfolded, /\r\nDTSTART:20261002T193000Z\r\n/);
  assert.match(unfolded, /\r\nDTEND:20261002T210000Z\r\n/);
  assert.match(unfolded, /\r\nDTSTAMP:20261001T080000Z\r\n/);
  assert.match(unfolded, /\r\nLOCATION:Ağ Şəhər\\, Bakı\r\n/);
  assert.equal((unfolded.match(/(?:^|\r\n)BEGIN:VEVENT\r\n/g) ?? []).length, 1);
  assert.match(unfolded, /SUMMARY:Hair\\nBEGIN:VEVENT · Gözəllik\\, Bakı\\; Studio\\\\North/);
  assert.doesNotMatch(unfolded, /secret-|95 AZN|40000000-0000/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  const encoder = new TextEncoder();
  for (const line of ics.trimEnd().split("\r\n")) {
    assert.ok(encoder.encode(line).length <= 75, `line too long: ${line}`);
  }
});

test("only future accepted bookings with exact slot end can export", () => {
  assert.equal(consumerBookingCanExportCalendar(booking, now), true);
  for (const status of ["pending_confirmation", "rejected", "cancelled", "unknown"] as const) {
    assert.equal(createConsumerBookingCalendar({ ...booking, status }, now), null);
  }
  assert.equal(createConsumerBookingCalendar({ ...booking, bookedUntil: null }, now), null);
  assert.equal(createConsumerBookingCalendar({ ...booking, bookedUntil: booking.bookedFor }, now), null);
  assert.equal(createConsumerBookingCalendar({ ...booking, bookedFor: "bad-date" }, now), null);
  assert.equal(createConsumerBookingCalendar(booking, Date.parse(booking.bookedFor)), null);
  assert.equal(createConsumerBookingCalendar({ ...booking, reference: "untrusted\r\nBEGIN:VEVENT" }, now), null);
});
