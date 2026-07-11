/**
 * Enriches events with real start/end times and venue coordinates by reading
 * schema.org JSON-LD off each event page.
 *
 * Writes an OVERLAY (src/data/event-times.json) keyed by event id.
 * events.json is never modified — the app merges the overlay at load.
 *
 *   node scripts/enrich-times.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const EVENTS = path.join(root, "src", "data", "events.json");
const OUT = path.join(root, "src", "data", "event-times.json");
const VENUES = path.join(root, "src", "data", "venues.json");

const UA = { "user-agent": "Mozilla/5.0 (compatible; ctw-planner)" };
const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;

// Chicago in July is CDT (UTC-5).
const CHICAGO_OFFSET = "-05:00";

// Luma returns the city centroid when a host hasn't published a real venue.
const CITY = { lat: 41.8781, lon: -87.6298 };
const CENTROID_TOL = 0.004;

/** Walk any JSON-LD graph and collect nodes that look like an Event. */
function findEventNodes(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findEventNodes(n, out);
    return out;
  }
  if (node.startDate) out.push(node);
  for (const v of Object.values(node)) {
    if (v && typeof v === "object") findEventNodes(v, out);
  }
  return out;
}

/**
 * Normalize a schema.org date to a Chicago-local ISO string.
 * Handles ISO-with-offset ("2026-07-20T18:30:00.000-05:00") and the non-ISO
 * shape some sites emit ("Mon Jul 20 05:00:00 UTC 2026").
 */
function normalizeDate(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (iso) {
    const offset = raw.match(/(Z|[+-]\d{2}:?\d{2})$/);
    // Already local-to-Chicago (or offset-less): trust the wall-clock as written.
    if (!offset || offset[1] === CHICAGO_OFFSET) {
      return `${iso[1]}T${iso[2]}:${iso[3]}:00${CHICAGO_OFFSET}`;
    }
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  // Shift the UTC instant into Chicago wall-clock.
  const chi = new Date(d.getTime() - 5 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${chi.getUTCFullYear()}-${p(chi.getUTCMonth() + 1)}-${p(chi.getUTCDate())}` +
    `T${p(chi.getUTCHours())}:${p(chi.getUTCMinutes())}:00${CHICAGO_OFFSET}`
  );
}

const hourOf = (isoLocal) => Number(isoLocal.slice(11, 13));

function isCentroid(lat, lon, name) {
  if (/^chicago,?\s*(il|illinois)?\.?$/i.test(String(name || "").trim())) return true;
  if (lat == null || lon == null) return false;
  return (
    Math.abs(lat - CITY.lat) < CENTROID_TOL && Math.abs(lon - CITY.lon) < CENTROID_TOL
  );
}

async function scrape(event) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(event.url, {
      headers: UA,
      signal: ctl.signal,
      redirect: "follow",
    });
    if (!res.ok) return { id: event.id, error: `HTTP ${res.status}` };

    const html = await res.text();
    const blocks = [
      ...html.matchAll(
        /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
      ),
    ].map((m) => m[1]);

    for (const block of blocks) {
      let parsed;
      try {
        parsed = JSON.parse(block);
      } catch {
        continue;
      }
      const [node] = findEventNodes(parsed);
      if (!node) continue;

      const startTime = normalizeDate(node.startDate);
      if (!startTime) continue;
      const endTime = normalizeDate(node.endDate);

      const loc = Array.isArray(node.location) ? node.location[0] : node.location;
      const lat = loc?.geo?.latitude ?? loc?.latitude ?? null;
      const lon = loc?.geo?.longitude ?? loc?.longitude ?? null;
      const venueName = loc?.name ?? null;

      // Some sources publish plainly wrong structured data. Partiful, for one,
      // advertises "2026-07-21T10:00:00.000Z" for an event its own page shows as
      // 1:00pm. We can't repair those, but we can refuse to present them as fact:
      // a tech-week event starting overnight is a data artifact, not a real time.
      // Anything implausible is downgraded so the UI tells the user to go and
      // check the event page rather than trusting us.
      const hour = hourOf(startTime);
      const plausible = hour >= 7 && hour < 23;
      const timeConfidence = plausible ? "confirmed" : "approximate";

      let venueConfidence = "unknown";
      if (lat != null && lon != null) {
        venueConfidence = isCentroid(lat, lon, venueName) ? "approximate" : "confirmed";
      }

      return {
        id: event.id,
        startTime,
        endTime,
        venueName,
        lat: venueConfidence === "confirmed" ? lat : null,
        lon: venueConfidence === "confirmed" ? lon : null,
        timeConfidence,
        venueConfidence,
        source: "jsonld",
      };
    }
    return { id: event.id, error: "no JSON-LD Event" };
  } catch (err) {
    return {
      id: event.id,
      error: err.name === "AbortError" ? "timeout" : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

const events = JSON.parse(fs.readFileSync(EVENTS, "utf8"));

// Hand-curated venue coordinates fill the gaps the scrape can't reach.
let venues = {};
if (fs.existsSync(VENUES)) {
  const raw = JSON.parse(fs.readFileSync(VENUES, "utf8"));
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("_")) venues[k] = v;
  }
}
const venueKey = (s) => String(s || "").trim().toLowerCase();

// Some events are online-only — no travel leg applies at all.
const isVirtual = (event) => /^(virtual|online|remote)$/i.test((event.location || "").trim());

const queue = [...events];
const scraped = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) scraped.push(await scrape(queue.shift()));
  })
);

const byId = new Map(scraped.map((r) => [r.id, r]));

// Coordinates the scrape already proved out, indexed by venue name, so a venue
// discovered on one event's page fills in every other event at that same venue.
// These come from the source data, not from us.
const scrapedVenues = new Map();
for (const r of scraped) {
  if (r.lat == null || r.venueConfidence !== "confirmed") continue;
  for (const key of [venueKey(r.venueName), venueKey(events.find((e) => e.id === r.id)?.location)]) {
    if (key && !scrapedVenues.has(key)) {
      scrapedVenues.set(key, { lat: r.lat, lon: r.lon, name: r.venueName });
    }
  }
}

const overlay = {};

for (const event of events) {
  const r = byId.get(event.id) || {};
  const rec = {
    startTime: r.startTime ?? null,
    endTime: r.endTime ?? null,
    venueName: r.venueName ?? null,
    lat: r.lat ?? null,
    lon: r.lon ?? null,
    timeConfidence: r.startTime ? r.timeConfidence : "unknown",
    venueConfidence: r.venueConfidence ?? "unknown",
  };

  if (isVirtual(event)) {
    rec.virtual = true;
    rec.venueConfidence = "virtual";
  }

  // 1) Reuse coordinates the scrape found for this same venue on another event.
  if (rec.lat == null && !rec.virtual) {
    const hit =
      scrapedVenues.get(venueKey(event.location)) ||
      scrapedVenues.get(venueKey(r.venueName));
    if (hit) {
      rec.lat = hit.lat;
      rec.lon = hit.lon;
      rec.venueName = rec.venueName || hit.name || event.location;
      rec.venueConfidence = "confirmed";
      rec.venueSource = "scraped-venue";
    }
  }

  // 2) Otherwise fall back to the curated venue list.
  if (rec.lat == null && !rec.virtual) {
    const hit = venues[venueKey(event.location)] || venues[venueKey(r.venueName)];
    if (hit) {
      rec.lat = hit.lat;
      rec.lon = hit.lon;
      rec.venueName = rec.venueName || hit.name || event.location;
      // 'approximate' venues resolved only to a street or city centroid — the app
      // must still tell the user to double-check the event page.
      rec.venueConfidence = hit.precision === "exact" ? "confirmed" : "approximate";
      rec.venueSource = "curated";
    }
  }

  overlay[event.id] = rec;
}

fs.writeFileSync(OUT, JSON.stringify(overlay, null, 2) + "\n");

const vals = Object.values(overlay);
const n = (f) => vals.filter(f).length;
console.log(`Wrote ${OUT}`);
console.log(`  events ............... ${vals.length}`);
console.log(`  start times .......... ${n((v) => v.startTime)}`);
console.log(`  end times ............ ${n((v) => v.endTime)}`);
console.log(`  time confirmed ....... ${n((v) => v.timeConfidence === "confirmed")}`);
console.log(`  ROUTABLE venues ...... ${n((v) => v.lat != null)}`);
console.log(`    from page geo ...... ${n((v) => v.lat != null && !v.venueSource)}`);
console.log(`    same venue reused .. ${n((v) => v.venueSource === "scraped-venue")}`);
console.log(`    from venues.json ... ${n((v) => v.venueSource === "curated")}`);
console.log(`  virtual (no travel) .. ${n((v) => v.virtual)}`);
console.log(`  venue approximate .... ${n((v) => v.venueConfidence === "approximate")}`);
console.log(`  venue unknown ........ ${n((v) => v.venueConfidence === "unknown")}`);
