import { dataWarning, effectiveSlot, formatTime, orderByTime } from "./times";
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
      // Group by the real scraped time, matching what the app shows. Using the
      // raw `slot` field here put 9am events under "Afternoon".
      const items = orderByTime(
        dayEvents.filter((e) => effectiveSlot(e) === slot.key)
      );
      if (!items.length) return "";
      const conflict =
        items.length > 1
          ? `<p class="conflict">Heads up: ${items.length} events in this slot</p>`
          : "";
      const cards = items
        .map((e) => {
          const note = plan.notes[String(e.id)]?.trim();
          const start = formatTime(e.startTime);
          const end = formatTime(e.endTime);
          const time = start ? `${start}${end ? `–${end}` : ""}` : "";
          const warning = dataWarning(e);
          return `
          <article class="card">
            <div class="emoji">${esc(e.emoji || "•")}</div>
            <div>
              ${time ? `<p class="time">${esc(time)}</p>` : ""}
              <h3>${esc(e.title)}</h3>
              <p class="meta">${esc(e.venueName || e.location || "Venue TBA")}</p>
              ${
                warning
                  ? `<p class="warn">⚠️ ${esc(warning)} — check the event page</p>`
                  : ""
              }
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
  .time {
    margin: 0 0 2px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.02em;
  }
  .meta {
    margin: 0 0 8px;
    color: var(--mute);
    font-size: 13px;
  }
  .warn {
    margin: 0 0 8px;
    color: var(--mute);
    font-size: 12px;
    font-weight: 800;
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
  const slug = (plan.name || "itinerary")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  downloadBlob(
    new Blob([html], { type: "text/html;charset=utf-8" }),
    `ctw-2026-${slug || "itinerary"}.html`
  );
}

/**
 * Anchor must be in the document for Firefox to honour the click, and the
 * object URL must outlive the click — revoking it synchronously can cancel the
 * download before the browser has read the blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export function printItinerary(plan: Plan, events: EventItem[]) {
  const html = buildItineraryHtml(plan, events);

  const frame = document.createElement("iframe");
  // A 0x0 iframe prints blank in Chrome — the print document is laid out against
  // the frame's box, so it needs real page dimensions. Park it offscreen at
  // roughly A4 @96dpi rather than collapsing it.
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = "794px";
  frame.style.height = "1123px";
  frame.style.border = "0";

  // onload and the safety-net timeout could both fire, which opened the dialog
  // twice and tore the iframe out from under it. Latch so only the first wins.
  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      return;
    }
    // Don't rip the frame out while the preview is still reading it.
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => frame.remove(), 500);
    };
    win.addEventListener("afterprint", cleanup, { once: true });
    win.focus();
    win.print();
    // Chrome's preview is non-blocking, and afterprint doesn't always fire.
    // Fall back to a generous timer so we never leave the frame behind.
    setTimeout(cleanup, 60000);
  };

  frame.onload = printOnce;
  // srcdoc fires load reliably; document.write() often doesn't.
  frame.srcdoc = html;
  document.body.appendChild(frame);
  setTimeout(printOnce, 1500);
}
