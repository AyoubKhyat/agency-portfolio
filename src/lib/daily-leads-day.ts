/**
 * Calendar helpers for the Daily Lead Agent's Today card. Pure and client-safe (no server imports).
 * `day` is the Casablanca calendar day the server already worked out (YYYY-MM-DD), so the browser's own
 * clock and time zone never decide which day it is.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day after `day` (YYYY-MM-DD → YYYY-MM-DD), across month and year ends. */
export function nextDay(day: string): string {
  if (!DAY.test(day)) throw new Error(`not a day: ${day}`);
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "Tuesday 17 November" for a YYYY-MM-DD day, the same on every device. */
export function dayLabel(day: string): string {
  if (!DAY.test(day)) throw new Error(`not a day: ${day}`);
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
