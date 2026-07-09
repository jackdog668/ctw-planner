import type { EventItem, Lane } from "../types";

const LANE_WEIGHT: Record<Lane, number> = {
  founder: 12,
  networker: 8,
  builder: 7,
  marketer: 6,
};

export function scoreEvent(event: EventItem, lanes: Lane[]): number {
  let score = 0;

  for (const lane of lanes) {
    if (event.tags.includes(lane)) score += LANE_WEIGHT[lane];
  }

  if (lanes.includes("founder")) score += event.founderBoost;

  if (event.hasRealVenue) score += 4;
  else score -= 6;

  if (event.dataQuality !== "ok") score -= 3;
  if (!event.date) score -= 10;

  if (event.tier === "must") score += 8;
  if (event.tier === "strong") score += 4;

  return score;
}

export function rankEvents(events: EventItem[], lanes: Lane[]): EventItem[] {
  return [...events].sort((a, b) => {
    const diff = scoreEvent(b, lanes) - scoreEvent(a, lanes);
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title);
  });
}
