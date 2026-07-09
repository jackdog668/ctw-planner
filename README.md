# CTW Planner

Personal Chicago Tech Week 2026 day planner.

- Pick lanes (Founder / Networker / Builder / Marketer)
- Browse a ranked morning / afternoon / evening timeline
- Star events into your plan
- Share a plan link or export a standalone HTML itinerary

## Dev

```bash
npm install
npm run dev
```

Event data lives in `src/data/events.json` (built from the scraped CSV via `node scripts/build-events.mjs`).
