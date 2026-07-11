import type { EventItem, TravelMode } from "../types";
import { formatDuration, gapMinutes } from "./times";

/**
 * Travel estimates with no API, no key, and no network calls.
 *
 * Coordinates come free from the event pages (schema.org `geo`) plus a curated
 * venue list, so a straight-line distance is all we need. We scale it by a
 * circuity factor to approximate real street distance, then divide by a
 * per-mode speed and add a fixed overhead (waiting for a train, parking, etc).
 *
 * These are ESTIMATES and are always presented as such — every chip carries a
 * one-tap link out to Google Maps for true, schedule-aware directions.
 */

const EARTH_RADIUS_KM = 6371;

/** Straight-line km between two points. */
export function haversine(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Chicago's grid means real routes run ~1.3x the straight-line distance. */
const CIRCUITY = 1.3;

const MODES: Record<
  TravelMode,
  { label: string; emoji: string; kmh: number; overheadMin: number; gmaps: string }
> = {
  walking: { label: "Walk", emoji: "🚶", kmh: 4.8, overheadMin: 0, gmaps: "walking" },
  bicycling: { label: "Bike", emoji: "🚲", kmh: 15, overheadMin: 3, gmaps: "bicycling" },
  transit: { label: "Transit", emoji: "🚆", kmh: 18, overheadMin: 8, gmaps: "transit" },
  driving: { label: "Drive", emoji: "🚗", kmh: 25, overheadMin: 5, gmaps: "driving" },
};

export const TRAVEL_MODES = Object.entries(MODES).map(([key, m]) => ({
  key: key as TravelMode,
  label: m.label,
  emoji: m.emoji,
}));

export function modeMeta(mode: TravelMode) {
  return MODES[mode];
}

/** Estimated minutes between two venues. */
export function estimateMinutes(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
  mode: TravelMode
): number {
  const { kmh, overheadMin } = MODES[mode];
  const km = haversine(aLat, aLon, bLat, bLon) * CIRCUITY;
  return Math.max(1, Math.round((km / kmh) * 60 + overheadMin));
}

/** Free deep link — a plain URL, no API key, no billing. */
export function directionsUrl(from: EventItem, to: EventItem, mode: TravelMode): string {
  const origin = `${from.lat},${from.lon}`;
  const destination = `${to.lat},${to.lon}`;
  return (
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${MODES[mode].gmaps}`
  );
}

export type TravelLeg =
  | { kind: "virtual"; message: string }
  | { kind: "unknown"; message: string }
  /** The two events run at the same time — travel time is moot. */
  | { kind: "overlap"; message: string; url: string }
  /** Coordinates known but no clock, so distance only — no verdict. */
  | { kind: "distance"; minutes: number; text: string; url: string }
  /** Full verdict: we know both the travel time and the real gap. */
  | {
      kind: "verdict";
      minutes: number;
      gap: number;
      status: "fine" | "tight" | "late";
      lateBy: number;
      text: string;
      url: string;
    };

/**
 * Work out the travel leg between two consecutive saved events.
 * Degradation is the common case here, not an edge case: most events don't
 * have a routable venue, so those paths are first-class.
 */
export function travelLeg(
  from: EventItem,
  to: EventItem,
  mode: TravelMode
): TravelLeg {
  if (from.virtual || to.virtual) {
    return { kind: "virtual", message: "One of these is virtual — no travel needed" };
  }

  const routable =
    from.lat != null && from.lon != null && to.lat != null && to.lon != null;
  if (!routable) {
    return {
      kind: "unknown",
      message: "Venue not confirmed — check the event page for the address",
    };
  }

  const minutes = estimateMinutes(from.lat!, from.lon!, to.lat!, to.lon!, mode);
  const url = directionsUrl(from, to, mode);
  const { emoji, label } = MODES[mode];

  const gap = gapMinutes(from, to);
  if (gap === null) {
    return {
      kind: "distance",
      minutes,
      text: `${emoji} ~${minutes} min by ${label.toLowerCase()}`,
      url,
    };
  }

  // A negative gap means the two events actually run at the same time — the
  // user has starred a genuine clash. Saying "late by 600 min" would be absurd.
  if (gap < 0) {
    return {
      kind: "overlap",
      message: "These run at the same time — you'd have to skip part of one",
      url,
    };
  }

  const slack = gap - minutes;
  const status: "fine" | "tight" | "late" =
    slack < 0 ? "late" : slack < 15 ? "tight" : "fine";
  const lateBy = slack < 0 ? Math.abs(slack) : 0;

  const head = `${emoji} ~${minutes} min by ${label.toLowerCase()} · ${formatDuration(
    gap
  )} gap`;
  const tail =
    status === "late"
      ? `⚠️ you might be late by ~${lateBy} min`
      : status === "tight"
        ? "tight, but doable"
        : "you're fine";

  return {
    kind: "verdict",
    minutes,
    gap,
    status,
    lateBy,
    text: `${head} — ${tail}`,
    url,
  };
}
