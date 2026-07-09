import type { Lane, Plan } from "../types";
import { DEFAULT_THEME, isThemeId } from "./themes";

const STORAGE_KEY = "ctw-planner-v1";
const READY_KEY = "ctw-planner-ready-v1";

const DEFAULT_PLAN: Plan = {
  name: "",
  lanes: ["founder", "networker", "builder"],
  savedIds: [],
  theme: DEFAULT_THEME,
};

function normalizePlan(parsed: Partial<Plan>): Plan {
  return {
    name: parsed.name || "",
    lanes:
      Array.isArray(parsed.lanes) && parsed.lanes.length
        ? parsed.lanes
        : [...DEFAULT_PLAN.lanes],
    savedIds: Array.isArray(parsed.savedIds) ? parsed.savedIds : [],
    theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME,
  };
}

export function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAN, lanes: [...DEFAULT_PLAN.lanes] };
    const parsed = JSON.parse(raw) as Partial<Plan>;
    return normalizePlan(parsed);
  } catch {
    return { ...DEFAULT_PLAN, lanes: [...DEFAULT_PLAN.lanes] };
  }
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
  const payload = {
    n: plan.name,
    l: plan.lanes,
    s: plan.savedIds,
    t: plan.theme,
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
    };
    return normalizePlan({
      name: payload.n || "",
      lanes: payload.l?.length ? payload.l : [...DEFAULT_PLAN.lanes],
      savedIds: payload.s || [],
      theme: isThemeId(payload.t) ? payload.t : DEFAULT_THEME,
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

export function shareUrl(plan: Plan): string {
  const url = new URL(window.location.href);
  url.searchParams.set("plan", encodePlan(plan));
  return url.toString();
}
