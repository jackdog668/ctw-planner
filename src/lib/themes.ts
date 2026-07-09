export type ThemeId =
  | "sky"
  | "seafoam"
  | "mint"
  | "sienna"
  | "forest"
  | "peach"
  | "pink"
  | "lavender"
  | "butter";

export type ThemeVars = {
  ink: string;
  mute: string;
  paper: string;
  panel: string;
  line: string;
  accent: string;
  accentSoft: string;
  saved: string;
  star: string;
};

export type Theme = {
  id: ThemeId;
  label: string;
  vars: ThemeVars;
};

export const DEFAULT_THEME: ThemeId = "sky";

/** Soft pastel full-surface themes. Panels are tinted, never pure white. */
export const THEMES: Theme[] = [
  {
    id: "sky",
    label: "Sky",
    vars: {
      ink: "#1e2a3a",
      mute: "#5a6b7d",
      paper: "#e8eef6",
      panel: "#f7f9fc",
      line: "#cfd9e6",
      accent: "#3b82f6",
      accentSoft: "#d4e4fb",
      saved: "#fff1e0",
      star: "#d97706",
    },
  },
  {
    id: "seafoam",
    label: "Seafoam",
    vars: {
      ink: "#163532",
      mute: "#4a6b66",
      paper: "#dcefeb",
      panel: "#eef8f5",
      line: "#b9d9d2",
      accent: "#2a9d8f",
      accentSoft: "#c5e8e1",
      saved: "#fff0d6",
      star: "#c9850a",
    },
  },
  {
    id: "mint",
    label: "Mint",
    vars: {
      ink: "#16382c",
      mute: "#4a6e5e",
      paper: "#dcf3e6",
      panel: "#eefaf3",
      line: "#b6ddc8",
      accent: "#2f9e6e",
      accentSoft: "#c5ebd8",
      saved: "#fff0d4",
      star: "#c9850a",
    },
  },
  {
    id: "sienna",
    label: "Sienna",
    vars: {
      ink: "#3a2418",
      mute: "#7a5644",
      paper: "#f3e6db",
      panel: "#faf3ec",
      line: "#e0c9b6",
      accent: "#c46b3a",
      accentSoft: "#f0d5c2",
      saved: "#ffe8c8",
      star: "#c9850a",
    },
  },
  {
    id: "forest",
    label: "Forest",
    vars: {
      ink: "#1a2e22",
      mute: "#4a6454",
      paper: "#dde8e0",
      panel: "#eef4ef",
      line: "#b9cec0",
      accent: "#3d7a57",
      accentSoft: "#c8ddcf",
      saved: "#fff0d4",
      star: "#b8860b",
    },
  },
  {
    id: "peach",
    label: "Peach",
    vars: {
      ink: "#3a261e",
      mute: "#7a564a",
      paper: "#f8e6dc",
      panel: "#fff4ee",
      line: "#e8cbbd",
      accent: "#d97855",
      accentSoft: "#f5d4c4",
      saved: "#fff0d4",
      star: "#c9850a",
    },
  },
  {
    id: "pink",
    label: "Pink",
    vars: {
      ink: "#3a1f2c",
      mute: "#7a4f62",
      paper: "#f6e0ea",
      panel: "#fff0f5",
      line: "#e5c0d0",
      accent: "#d65a8a",
      accentSoft: "#f0c9da",
      saved: "#fff0d4",
      star: "#c9850a",
    },
  },
  {
    id: "lavender",
    label: "Lavender",
    vars: {
      ink: "#2a2440",
      mute: "#5f5678",
      paper: "#e8e2f4",
      panel: "#f4f0fa",
      line: "#cfc4e4",
      accent: "#7c5cbf",
      accentSoft: "#ddd2f0",
      saved: "#fff0d4",
      star: "#c9850a",
    },
  },
  {
    id: "butter",
    label: "Butter",
    vars: {
      ink: "#3a3018",
      mute: "#6e5f3a",
      paper: "#f5ebd0",
      panel: "#fff8e8",
      line: "#e4d4a8",
      accent: "#c4920f",
      accentSoft: "#f0e0a8",
      saved: "#ffe4c4",
      star: "#d97706",
    },
  },
];

const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_MAP.has(value as ThemeId);
}

export function getTheme(id: ThemeId | string | undefined | null): Theme {
  if (id && isThemeId(id)) return THEME_MAP.get(id)!;
  return THEME_MAP.get(DEFAULT_THEME)!;
}

export function themeCssVars(theme: Theme): Record<string, string> {
  const { vars } = theme;
  return {
    "--ink": vars.ink,
    "--mute": vars.mute,
    "--paper": vars.paper,
    "--panel": vars.panel,
    "--line": vars.line,
    "--accent": vars.accent,
    "--accent-soft": vars.accentSoft,
    "--saved": vars.saved,
    "--star": vars.star,
  };
}

export function themeCssBlock(theme: Theme): string {
  const vars = themeCssVars(theme);
  return Object.entries(vars)
    .map(([key, value]) => `    ${key}: ${value};`)
    .join("\n");
}
