import type { ThemeId } from "./lib/themes";

export type Lane = "founder" | "networker" | "builder" | "marketer";
export type Slot = "morning" | "afternoon" | "evening";
export type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type { ThemeId };

export type EventItem = {
  id: number;
  title: string;
  date: string | null;
  weekday: DayKey | null;
  location: string;
  emoji: string;
  vibe: string;
  url: string;
  hasRealVenue: boolean;
  dataQuality: string;
  tags: Lane[];
  slot: Slot;
  founderBoost: number;
  tier: string | null;
  why: string | null;
};

export type Plan = {
  name: string;
  lanes: Lane[];
  savedIds: number[];
  theme: ThemeId;
  notes: Record<string, string>;
};

export const DAYS: { key: DayKey; date: string; label: string }[] = [
  { key: "Mon", date: "2026-07-20", label: "Mon 20" },
  { key: "Tue", date: "2026-07-21", label: "Tue 21" },
  { key: "Wed", date: "2026-07-22", label: "Wed 22" },
  { key: "Thu", date: "2026-07-23", label: "Thu 23" },
  { key: "Fri", date: "2026-07-24", label: "Fri 24" },
  { key: "Sat", date: "2026-07-25", label: "Sat 25" },
];

export const SLOTS: { key: Slot; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
];

export const LANES: { key: Lane; label: string; blurb: string }[] = [
  { key: "founder", label: "Founder", blurb: "Pitches, funders, founder rooms" },
  { key: "networker", label: "Networker", blurb: "Mixers, kickoffs, serendipity" },
  { key: "builder", label: "Builder", blurb: "AI, demos, hands-on tech" },
  { key: "marketer", label: "Marketer", blurb: "GTM, revenue, brand rooms" },
];
