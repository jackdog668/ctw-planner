import type { Lane, Plan } from "../types";
import { DEFAULT_THEME, isThemeId } from "./themes";

const STORAGE_KEY = "ctw-planner-v1";
const READY_KEY = "ctw-planner-ready-v1";

const DEFAULT_PLAN: Plan = {
  name: "",
  lanes: ["founder", "networker", "builder"],
  savedIds: [],
  theme: DEFAULT_THEME,
  notes: {},
};

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
  };
}

export function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAN, lanes: [...DEFAULT_PLAN.lanes], notes: {} };
    const parsed = JSON.parse(raw) as Partial<Plan>;
    return normalizePlan(parsed);
  } catch {
    return { ...DEFAULT_PLAN, lanes: [...DEFAULT_PLAN.lanes], notes: {} };
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
  const notesEntries = Object.entries(plan.notes).filter(([, v]) => v.trim());
  const payload = {
    n: plan.name,
    l: plan.lanes,
    s: plan.savedIds,
    t: plan.theme,
    o: notesEntries.length ? Object.fromEntries(notesEntries) : undefined,
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
    };
    return normalizePlan({
      name: payload.n || "",
      lanes: payload.l?.length ? payload.l : [...DEFAULT_PLAN.lanes],
      savedIds: payload.s || [],
      theme: isThemeId(payload.t) ? payload.t : DEFAULT_THEME,
      notes: payload.o || {},
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
