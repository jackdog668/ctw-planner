import { downloadBlob } from "./exportHtml";
import type { EventItem, Plan, Slot } from "../types";

/** Fallback only — used when an event has no real scraped time. */
export const SLOT_HOURS: Record<Slot, { start: number; end: number }> = {
  morning: { start: 9, end: 12 },
  afternoon: { start: 13, end: 16 },
  evening: { start: 17, end: 20 },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIcsDate(date: string, hour: number, minute = 0) {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(hour)}${pad(minute)}00`;
}

/** "2026-07-20T18:30:00-05:00" -> "20260720T183000" (local wall-clock). */
function icsFromIso(iso: string) {
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(
    11,
    13
  )}${iso.slice(14, 16)}00`;
}

function escIcs(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildIcs(plan: Plan, events: EventItem[]): string {
  const byId = new Map(events.map((e) => [e.id, e]));
  const saved = plan.savedIds
    .map((id) => byId.get(id))
    .filter((e): e is EventItem => Boolean(e?.date));

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const vevents = saved
    .map((e) => {
      // Prefer the real scraped time; fall back to the slot approximation.
      const exact = e.startTime && e.timeConfidence === "confirmed";
      const hours = SLOT_HOURS[e.slot];
      const dtStart = exact
        ? icsFromIso(e.startTime!)
        : toIcsDate(e.date!, hours.start);
      const dtEnd =
        exact && e.endTime
          ? icsFromIso(e.endTime)
          : exact
            ? icsFromIso(e.startTime!).replace(
                /T(\d{2})/,
                (_, h) => `T${pad((Number(h) + 2) % 24)}`
              )
            : toIcsDate(e.date!, hours.end);

      const note = plan.notes[e.id]?.trim();
      const desc = [
        e.location,
        note ? `Note: ${note}` : "",
        e.url,
        exact
          ? "Time from the event page — double-check before you go."
          : "Time is approximate (morning/afternoon/evening) — check the event page.",
      ]
        .filter(Boolean)
        .join("\\n");

      return [
        "BEGIN:VEVENT",
        `UID:ctw-${e.id}@ctw-planner`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escIcs(e.title)}`,
        `LOCATION:${escIcs(e.location || "Chicago")}`,
        `DESCRIPTION:${escIcs(desc)}`,
        e.url ? `URL:${e.url}` : "",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CTW Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escIcs((plan.name || "My") + " CTW 2026")}`,
    vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(plan: Plan, events: EventItem[]) {
  const ics = buildIcs(plan, events);
  const slug = (plan.name || "plan")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  downloadBlob(
    new Blob([ics], { type: "text/calendar;charset=utf-8" }),
    `ctw-2026-${slug || "plan"}.ics`
  );
}
