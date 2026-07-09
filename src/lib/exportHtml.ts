import type { EventItem, Plan } from "../types";
import { DAYS, SLOTS } from "../types";
import { getTheme, themeCssBlock } from "./themes";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildItineraryHtml(plan: Plan, events: EventItem[]): string {
  const theme = getTheme(plan.theme);
  const byId = new Map(events.map((e) => [e.id, e]));
  const saved = plan.savedIds
    .map((id) => byId.get(id))
    .filter((e): e is EventItem => Boolean(e));

  const dayBlocks = DAYS.map((day) => {
    const dayEvents = saved.filter((e) => e.weekday === day.key);
    if (!dayEvents.length) return "";

    const slots = SLOTS.map((slot) => {
      const items = dayEvents.filter((e) => e.slot === slot.key);
      if (!items.length) return "";
      const conflict =
        items.length > 1
          ? `<p class="conflict">Heads up: ${items.length} events in this slot</p>`
          : "";
      const cards = items
        .map((e) => {
          const note = plan.notes[String(e.id)]?.trim();
          return `
          <article class="card">
            <div class="emoji">${esc(e.emoji || "•")}</div>
            <div>
              <h3>${esc(e.title)}</h3>
              <p class="meta">${esc(e.location || "Venue TBA")}</p>
              ${note ? `<p class="note">${esc(note)}</p>` : ""}
              <a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Open event</a>
            </div>
          </article>`;
        })
        .join("");
      return `<section class="slot"><h2>${slot.label}</h2>${conflict}${cards}</section>`;
    }).join("");

    return `
      <section class="day">
        <header>
          <h1>${day.key}</h1>
          <p>${day.date}</p>
        </header>
        ${slots}
      </section>`;
  }).join("");

  const lanes = plan.lanes.map((l) => l[0].toUpperCase() + l.slice(1)).join(" · ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(plan.name || "My")} · Chicago Tech Week '26</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet" />
<style>
  :root {
${themeCssBlock(theme)}
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Nunito, system-ui, sans-serif;
    background: var(--paper);
    color: var(--ink);
    line-height: 1.45;
    font-weight: 700;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  .mast { margin-bottom: 28px; }
  .mast p { margin: 6px 0 0; color: var(--mute); font-size: 14px; }
  .mast h1 {
    margin: 0;
    font-size: clamp(2rem, 5vw, 2.6rem);
    letter-spacing: -0.03em;
    font-weight: 900;
  }
  .theme-chip {
    display: inline-block;
    margin-top: 10px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 12px;
    font-weight: 800;
  }
  .day { margin: 0 0 28px; }
  .day > header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 0 10px;
  }
  .day > header h1 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 900;
  }
  .day > header p {
    margin: 0;
    color: var(--mute);
    font-size: 13px;
  }
  .slot h2 {
    margin: 14px 0 10px;
    font-size: 0.95rem;
    font-weight: 900;
    color: var(--ink);
  }
  .conflict {
    margin: 0 0 10px;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--saved);
    color: var(--ink);
    font-size: 13px;
  }
  .card {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 14px 16px;
    margin: 0 0 10px;
  }
  .emoji { font-size: 1.2rem; line-height: 1.2; }
  .card h3 {
    margin: 0 0 4px;
    font-size: 1.1rem;
    font-weight: 900;
  }
  .meta {
    margin: 0 0 8px;
    color: var(--mute);
    font-size: 13px;
  }
  .note {
    margin: 0 0 8px;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--ink);
    font-size: 13px;
  }
  a {
    color: var(--accent);
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
  }
  .empty { color: var(--mute); font-size: 14px; }
  @media print {
    body { background: var(--paper); }
    .card { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="mast">
      <h1>${esc(plan.name || "My itinerary")}</h1>
      <p>Chicago Tech Week · July 20–25, 2026</p>
      <p>Lanes: ${esc(lanes || "General")} · ${saved.length} saved events</p>
      <span class="theme-chip">${esc(theme.label)} theme</span>
    </header>
    ${dayBlocks || '<p class="empty">No events saved yet.</p>'}
  </div>
</body>
</html>`;
}

export function downloadItinerary(plan: Plan, events: EventItem[]) {
  const html = buildItineraryHtml(plan, events);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (plan.name || "itinerary")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  a.href = url;
  a.download = `ctw-2026-${slug || "itinerary"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printItinerary(plan: Plan, events: EventItem[]) {
  const html = buildItineraryHtml(plan, events);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => {
    setTimeout(() => {
      if (frame.parentNode) document.body.removeChild(frame);
    }, 500);
  };
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    cleanup();
  };
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    cleanup();
  }, 400);
}
