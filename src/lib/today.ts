import { DAYS, type DayKey } from "../types";

/** Pick today's CTW day if we're in the week; otherwise Mon (or nearest upcoming). */
export function defaultDayKey(now = new Date()): DayKey {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const today = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const exact = DAYS.find((day) => day.date === today);
  if (exact) return exact.key;

  const upcoming = DAYS.find((day) => day.date > today);
  if (upcoming) return upcoming.key;

  return DAYS[DAYS.length - 1].key;
}
