# CTW Planner

Personal Chicago Tech Week 2026 day planner.

- Pick lanes (Founder / Networker / Builder / Marketer)
- Browse a ranked morning / afternoon / evening timeline
- Star events into your plan, or let **"Plan my week for me"** draft a conflict-free week
- See **travel time between back-to-back events** for your transport mode
- Share a plan link or export a standalone HTML itinerary / calendar file

## Dev

```bash
npm install
npm run dev
```

## Event data

`src/data/events.json` is the committed source of truth (built from a scraped CSV via
`npm run build:events` — the CSVs aren't in the repo, so pass paths explicitly if you ever
need to regenerate).

### Times & venues

`npm run enrich:times` reads each event's public page, pulls the schema.org JSON-LD, and writes
`src/data/event-times.json` — an **overlay** keyed by event id. `events.json` is never modified;
the app merges the two at load.

This matters because the original `slot` field was mostly guesswork: `inferSlot()` defaults
unmatched events to `"afternoon"`, so ~16 evening events were being shown as afternoon ones.
The overlay supplies real start/end times where they exist.

Coverage (of 77 events):

| | |
|---|---|
| Real start times | 51 |
| Routable venue coordinates | 56 |
| Virtual (no travel) | 2 |
| Venue/time unconfirmed | the rest |

**Confidence is tracked, not assumed.** Times are only marked `confirmed` when they're plausible —
some sources publish plainly wrong structured data (Partiful advertises a 10:00Z start for an event
its own page shows at 1pm), so anything overnight is downgraded to `approximate`. Anything not
confirmed shows an inline "check the event page" prompt with a link, rather than a confident guess.

`src/data/venues.json` hand-fills coordinates for venues whose page exposes no geo data. Coordinates
were resolved via OpenStreetMap and bounds-checked to Chicago — `precision: "approximate"` means only
the street or city centroid resolved.

## Travel times

Estimates are computed locally: straight-line distance × a circuity factor, ÷ a per-mode speed,
plus a fixed overhead (CTA wait, parking, Divvy dock). **No API key, no billing, no network calls** —
it works offline.

They're estimates, so they're always shown with a `~` and framed as *"you might be late by ~N min"*
rather than a false promise. Every hop carries a one-tap **Directions** link to Google Maps (a plain
URL, no API) for the real, schedule-aware route.
