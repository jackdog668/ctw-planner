import type { Lane, Plan, TravelMode } from "../types";
import { DEFAULT_THEME, isThemeId } from "./themes";

const STORAGE_KEY = "ctw-planner-v1";
const READY_KEY = "ctw-planner-ready-v1";

const TRAVEL_MODES: TravelMode[] = ["walking", "bicycling", "transit", "driving"];
export const DEFAULT_TRANSPORT: TravelMode = "transit";

function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === "string" && TRAVEL_MODES.includes(value as TravelMode);
}

const DEFAULT_PLAN: Plan = {
  name: "",
  lanes: ["founder", "networker", "builder"],
  savedIds: [],
  theme: DEFAULT_THEME,
  notes: {},
  transport: DEFAULT_TRANSPORT,
};

export function emptyPlan(): Plan {
  return {
    ...DEFAULT_PLAN,
    lanes: [...DEFAULT_PLAN.lanes],
    notes: {},
  };
}

function normalizeNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

function normalizePlan(parsed: Partial<Plan> & { notes?: unknown }): Plan {
  return {
    name: parsed.name || "",
    lanes:
      Array.isArray(parsed.lanes) && parsed.lanes.length
        ? parsed.lanes
        : [...DEFAULT_PLAN.lanes],
    savedIds: Array.isArray(parsed.savedIds) ? parsed.savedIds : [],
    theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME,
    notes: normalizeNotes(parsed.notes),
    // Absent on plans saved before travel mode existed — fall back to the default.
    transport: isTravelMode(parsed.transport) ? parsed.transport : DEFAULT_TRANSPORT,
  };
}

export function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPlan();
    const parsed = JSON.parse(raw) as Partial<Plan>;
    return normalizePlan(parsed);
  } catch {
    return emptyPlan();
  }
}

/** Strip ?plan= so a refresh doesn't re-enter shared-view mode. */
export function clearPlanQuery(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("plan")) return;
  url.searchParams.delete("plan");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function savePlan(plan: Plan) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function loadReady(): boolean {
  return localStorage.getItem(READY_KEY) === "1";
}

export function saveReady(ready: boolean) {
  if (ready) localStorage.setItem(READY_KEY, "1");
  else localStorage.removeItem(READY_KEY);
}

export function encodePlan(plan: Plan): string {
  const notesEntries = Object.entries(plan.notes).filter(([, v]) => v.trim());
  const payload = {
    n: plan.name,
    l: plan.lanes,
    s: plan.savedIds,
    t: plan.theme,
    o: notesEntries.length ? Object.fromEntries(notesEntries) : undefined,
    tp: plan.transport,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodePlan(token: string): Plan | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(padded)));
    const payload = JSON.parse(json) as {
      n?: string;
      l?: Lane[];
      s?: number[];
      t?: string;
      o?: Record<string, string>;
      tp?: string;
    };
    return normalizePlan({
      name: payload.n || "",
      lanes: payload.l?.length ? payload.l : [...DEFAULT_PLAN.lanes],
      savedIds: payload.s || [],
      theme: isThemeId(payload.t) ? payload.t : DEFAULT_THEME,
      notes: payload.o || {},
      // Older links have no `tp` — normalizePlan supplies the default.
      transport: isTravelMode(payload.tp) ? payload.tp : DEFAULT_TRANSPORT,
    });
  } catch {
    return null;
  }
}

export function planFromUrl(): Plan | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("plan");
  if (!token) return null;
  return decodePlan(token);
}

export function extractPlanToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.includes("plan=")) {
      const url = new URL(trimmed);
      return url.searchParams.get("plan");
    }
  } catch {
    // not a full URL — treat as raw token
  }
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export function shareUrl(plan: Plan): string {
  const url = new URL(window.location.href);
  url.searchParams.set("plan", encodePlan(plan));
  return url.toString();
}
