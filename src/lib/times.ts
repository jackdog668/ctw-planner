import timesData from "../data/event-times.json";
import type { EventItem, Slot } from "../types";

type Overlay = {
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  lat: number | null;
  lon: number | null;
  timeConfidence: Confidence;
  venueConfidence: Confidence | "virtual";
  venueSource?: string;
  virtual?: boolean;
};

export type Confidence = "confirmed" | "approximate" | "unknown";

const overlay = timesData as unknown as Record<string, Overlay>;

/**
 * Merge scraped times/coords onto the base events. The overlay is additive —
 * events.json is never mutated, and an event with no overlay entry behaves
 * exactly as it did before this feature existed.
 */
export function withTimes(events: EventItem[]): EventItem[] {
  return events.map((event) => {
    const o = overlay[String(event.id)];
    if (!o) return event;
    return {
      ...event,
      startTime: o.startTime,
      endTime: o.endTime,
      venueName: o.venueName,
      lat: o.lat,
      lon: o.lon,
      timeConfidence: o.timeConfidence,
      venueConfidence: o.venueConfidence,
      virtual: Boolean(o.virtual),
    };
  });
}

/** Real time wins; otherwise fall back to the original hand-tagged slot. */
export function effectiveSlot(event: EventItem): Slot {
  if (!event.startTime) return event.slot;
  const hour = Number(event.startTime.slice(11, 13));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Minutes since midnight, or null when the event has no confirmed time. */
export function startMinutes(event: EventItem): number | null {
  if (!event.startTime) return null;
  return (
    Number(event.startTime.slice(11, 13)) * 60 +
    Number(event.startTime.slice(14, 16))
  );
}

export function endMinutes(event: EventItem): number | null {
  if (!event.endTime) return null;
  return (
    Number(event.endTime.slice(11, 13)) * 60 +
    Number(event.endTime.slice(14, 16))
  );
}

/** True when two events actually overlap on the clock. */
export function overlaps(a: EventItem, b: EventItem): boolean {
  const aStart = startMinutes(a);
  const bStart = startMinutes(b);
  if (aStart === null || bStart === null) return false;
  // Assume a 90-minute default when an end time is missing.
  const aEnd = endMinutes(a) ?? aStart + 90;
  const bEnd = endMinutes(b) ?? bStart + 90;
  return aStart < bEnd && bStart < aEnd;
}

/** Order a day's events by real start time, falling back to slot order. */
export function orderByTime(events: EventItem[]): EventItem[] {
  const slotRank: Record<Slot, number> = { morning: 0, afternoon: 1, evening: 2 };
  return [...events].sort((a, b) => {
    const aMin = startMinutes(a);
    const bMin = startMinutes(b);
    if (aMin !== null && bMin !== null) return aMin - bMin;
    const aSlot = slotRank[effectiveSlot(a)];
    const bSlot = slotRank[effectiveSlot(b)];
    if (aSlot !== bSlot) return aSlot - bSlot;
    // Timed events sort ahead of untimed ones within the same slot.
    if (aMin !== null) return -1;
    if (bMin !== null) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Free minutes between the end of `a` and the start of `b`. Null if unknowable. */
export function gapMinutes(a: EventItem, b: EventItem): number | null {
  const aStart = startMinutes(a);
  const bStart = startMinutes(b);
  if (aStart === null || bStart === null) return null;
  const aEnd = endMinutes(a) ?? aStart + 90;
  return bStart - aEnd;
}

export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  let hour = Number(iso.slice(11, 13));
  const minute = iso.slice(14, 16);
  const suffix = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return minute === "00" ? `${hour}${suffix}` : `${hour}:${minute}${suffix}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * The warning to show when we can't fully trust the data. The user should be
 * pointed at the event page rather than given a confident-looking guess.
 */
export function dataWarning(event: EventItem): string | null {
  const timeBad = event.timeConfidence && event.timeConfidence !== "confirmed";
  const venueBad =
    !event.virtual &&
    event.venueConfidence &&
    event.venueConfidence !== "confirmed";

  if (timeBad && venueBad) return "Time and venue aren't confirmed";
  if (timeBad) return "Time isn't confirmed";
  if (event.venueConfidence === "approximate")
    return "Venue is approximate — often revealed after you register";
  if (venueBad) return "Venue isn't confirmed";
  return null;
}
