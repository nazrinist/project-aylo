import type { ConsumerBooking } from "@/types/booking";

// iCalendar content lines are limited to 75 UTF-8 octets. Continuations start
// with one space, which counts toward that limit.
function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}

function escapeText(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function consumerBookingCanExportCalendar(booking: ConsumerBooking, nowMs = Date.now()) {
  const start = Date.parse(booking.bookedFor);
  const end = booking.bookedUntil ? Date.parse(booking.bookedUntil) : NaN;
  return booking.status === "accepted" && Number.isFinite(start) &&
    Number.isFinite(end) && start > nowMs && end > start &&
    /^[A-Fa-f0-9]{8}$/.test(booking.reference) &&
    Number.isFinite(Date.parse(booking.createdAt));
}

export function createConsumerBookingCalendar(booking: ConsumerBooking, nowMs = Date.now()) {
  if (!consumerBookingCanExportCalendar(booking, nowMs)) return null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aylo//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:aylo-${booking.reference.toLowerCase()}-${Date.parse(booking.createdAt)}@booking.aylo`,
    `DTSTAMP:${utc(new Date(nowMs))}`,
    `DTSTART:${utc(new Date(booking.bookedFor))}`,
    `DTEND:${utc(new Date(booking.bookedUntil!))}`,
    `SUMMARY:${escapeText(`${booking.serviceName} · ${booking.businessName}`)}`,
    ...(booking.address ? [`LOCATION:${escapeText(booking.address)}`] : []),
    `DESCRIPTION:${escapeText(`Aylo booking ${booking.reference}. Changes in Aylo do not update this calendar event automatically.`)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
