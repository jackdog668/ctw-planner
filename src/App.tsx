import { useEffect, useMemo, useState, type CSSProperties } from "react";
import eventsData from "./data/events.json";
import { downloadItinerary } from "./lib/exportHtml";
import {
  loadPlan,
  loadReady,
  planFromUrl,
  savePlan,
  saveReady,
  shareUrl,
} from "./lib/plan";
import { rankEvents } from "./lib/ranking";
import {
  getTheme,
  THEMES,
  themeCssVars,
  type ThemeId,
} from "./lib/themes";
import {
  DAYS,
  LANES,
  SLOTS,
  type DayKey,
  type EventItem,
  type Lane,
  type Plan,
} from "./types";
import "./App.css";

const events = eventsData as EventItem[];

type Tab = "browse" | "week" | "plan";

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => planFromUrl() || loadPlan());
  const [ready, setReady] = useState(() => {
    const fromUrl = planFromUrl();
    if (fromUrl?.name) return true;
    return loadReady() && Boolean(loadPlan().name);
  });
  const [day, setDay] = useState<DayKey>("Mon");
  const [tab, setTab] = useState<Tab>("browse");
  const [vibeFilter, setVibeFilter] = useState<Lane | "all">("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  useEffect(() => {
    saveReady(ready);
  }, [ready]);

  useEffect(() => {
    const vars = themeCssVars(getTheme(plan.theme));
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }, [plan.theme]);

  function setTheme(theme: ThemeId) {
    setPlan((p) => ({ ...p, theme }));
  }

  function seedFounderPicks() {
    const picks = events
      .filter((e) => e.tier === "must" || e.tier === "strong")
      .map((e) => e.id);
    setPlan((p) => ({
      ...p,
      savedIds: [...new Set([...p.savedIds, ...picks])],
    }));
    setTab("plan");
  }

  const filteredEvents = useMemo(() => {
    if (vibeFilter === "all") return events;
    return events.filter((e) => e.tags.includes(vibeFilter));
  }, [vibeFilter]);

  const rankedDay = useMemo(() => {
    const dayEvents = filteredEvents.filter((e) => e.weekday === day);
    return rankEvents(dayEvents, plan.lanes);
  }, [day, plan.lanes, filteredEvents]);

  const weekByDay = useMemo(() => {
    return DAYS.map((d) => ({
      day: d,
      events: rankEvents(
        filteredEvents.filter((e) => e.weekday === d.key),
        plan.lanes
      ),
    }));
  }, [filteredEvents, plan.lanes]);

  const savedEvents = useMemo(() => {
    const byId = new Map(events.map((e) => [e.id, e]));
    return plan.savedIds
      .map((id) => byId.get(id))
      .filter((e): e is EventItem => Boolean(e));
  }, [plan.savedIds]);

  function toggleLane(lane: Lane) {
    setPlan((p) => {
      const has = p.lanes.includes(lane);
      if (has && p.lanes.length === 1) return p;
      return {
        ...p,
        lanes: has ? p.lanes.filter((l) => l !== lane) : [...p.lanes, lane],
      };
    });
  }

  function toggleSave(id: number) {
    setPlan((p) => ({
      ...p,
      savedIds: p.savedIds.includes(id)
        ? p.savedIds.filter((x) => x !== id)
        : [...p.savedIds, id],
    }));
  }

  async function copyShare() {
    const url = shareUrl(plan);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      prompt("Copy this plan link:", url);
    }
  }

  if (!ready) {
    return (
      <div className="shell">
        <div className="shell-top">
          <div className="brand-mark" aria-hidden="true">
            <i className="dot" />
            <span>CTW Planner</span>
          </div>
          <ThemePicker value={plan.theme} onChange={setTheme} />
        </div>
        <Setup
          plan={plan}
          onName={(name) => setPlan((p) => ({ ...p, name }))}
          onToggleLane={toggleLane}
          onStart={() => {
            if (!plan.name.trim()) return;
            setReady(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="brand-mark" aria-hidden="true">
        <i className="dot" />
        <span>CTW Planner</span>
      </div>
      <header className="top">
        <div>
          <p className="eyebrow">Chicago · Jul 20–25</p>
          <h1>{possessive(plan.name)} week</h1>
          <p className="lanes-line">
            {plan.lanes.map((l) => l[0].toUpperCase() + l.slice(1)).join(" · ")}
          </p>
        </div>
        <div className="top-actions">
          <ThemePicker value={plan.theme} onChange={setTheme} />
          <div className="top-actions-row">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setReady(false);
                saveReady(false);
              }}
            >
              Edit lanes
            </button>
            <button type="button" className="ghost" onClick={copyShare}>
              {copied ? "Copied" : "Share plan"}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => downloadItinerary(plan, events)}
              disabled={!plan.savedIds.length}
            >
              Export HTML
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={tab === "browse" ? "active" : ""}
          onClick={() => setTab("browse")}
        >
          Day
        </button>
        <button
          type="button"
          className={tab === "week" ? "active" : ""}
          onClick={() => setTab("week")}
        >
          Full week
        </button>
        <button
          type="button"
          className={tab === "plan" ? "active" : ""}
          onClick={() => setTab("plan")}
        >
          My plan ({plan.savedIds.length})
        </button>
      </nav>

      {(tab === "browse" || tab === "week") && (
        <div className="filter-row">
          <button
            type="button"
            className={vibeFilter === "all" ? "pill active" : "pill"}
            onClick={() => setVibeFilter("all")}
          >
            All vibes
          </button>
          {LANES.map((l) => (
            <button
              key={l.key}
              type="button"
              className={vibeFilter === l.key ? "pill active" : "pill"}
              onClick={() => setVibeFilter(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {tab === "browse" && (
        <>
          <div className="day-row">
            {DAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                className={day === d.key ? "day-chip active" : "day-chip"}
                onClick={() => setDay(d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <Timeline
            events={rankedDay}
            savedIds={plan.savedIds}
            onToggle={toggleSave}
          />
        </>
      )}

      {tab === "week" && (
        <WeekView
          weekByDay={weekByDay}
          savedIds={plan.savedIds}
          onToggle={toggleSave}
          onJumpDay={(key) => {
            setDay(key);
            setTab("browse");
          }}
        />
      )}

      {tab === "plan" && (
        <MyPlan
          events={savedEvents}
          savedIds={plan.savedIds}
          onToggle={toggleSave}
          onExport={() => downloadItinerary(plan, events)}
          onSeed={seedFounderPicks}
        />
      )}
    </div>
  );
}

function possessive(name: string) {
  const trimmed = name.trim() || "My";
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}) {
  return (
    <div className="theme-picker">
      <span className="theme-picker-label">Theme</span>
      <div className="theme-swatches" role="listbox" aria-label="Color theme">
        {THEMES.map((theme) => {
          const selected = value === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={theme.label}
              className={selected ? "theme-swatch on" : "theme-swatch"}
              onClick={() => onChange(theme.id)}
              title={theme.label}
              style={
                {
                  "--swatch-accent": theme.vars.accent,
                  "--swatch-paper": theme.vars.paper,
                } as CSSProperties
              }
            >
              <i className="swatch-dot" aria-hidden="true" />
              <span className="swatch-label">{theme.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Setup({
  plan,
  onName,
  onToggleLane,
  onStart,
}: {
  plan: Plan;
  onName: (name: string) => void;
  onToggleLane: (lane: Lane) => void;
  onStart: () => void;
}) {
  return (
    <section className="setup">
      <p className="eyebrow">Your week, simplified</p>
      <h1>Plan a nicer Tech Week</h1>
      <p className="lede">
        Pick your lanes, star the good stuff, and export a cute HTML itinerary
        for you or a friend.
      </p>

      <div className="setup-panel">
        <label className="field">
          <span>Your name</span>
          <input
            value={plan.name}
            onChange={(e) => onName(e.target.value)}
            placeholder="e.g. Alex"
            autoFocus
          />
        </label>

        <div className="lane-grid">
          {LANES.map((lane) => {
            const on = plan.lanes.includes(lane.key);
            return (
              <button
                key={lane.key}
                type="button"
                className={on ? "lane-card on" : "lane-card"}
                onClick={() => onToggleLane(lane.key)}
                aria-pressed={on}
              >
                <strong>{lane.label}</strong>
                <span>{lane.blurb}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="primary wide"
          disabled={!plan.name.trim() || !plan.lanes.length}
          onClick={onStart}
        >
          Open my timeline
        </button>
      </div>
    </section>
  );
}

function Timeline({
  events,
  savedIds,
  onToggle,
}: {
  events: EventItem[];
  savedIds: number[];
  onToggle: (id: number) => void;
}) {
  return (
    <div className="timeline">
      {SLOTS.map((slot) => {
        const items = events.filter((e) => e.slot === slot.key);
        return (
          <section key={slot.key} className="slot-block">
            <header className="slot-head">
              <h2>{slot.label}</h2>
              <span>{items.length}</span>
            </header>
            {items.length ? (
              <div className="cards">
                {items.map((event, i) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    rank={i + 1}
                    saved={savedIds.includes(event.id)}
                    onToggle={() => onToggle(event.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="empty">Nothing in this slot for these filters.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WeekView({
  weekByDay,
  savedIds,
  onToggle,
  onJumpDay,
}: {
  weekByDay: { day: (typeof DAYS)[number]; events: EventItem[] }[];
  savedIds: number[];
  onToggle: (id: number) => void;
  onJumpDay: (key: DayKey) => void;
}) {
  const total = weekByDay.reduce((n, d) => n + d.events.length, 0);

  return (
    <div className="week-view">
      <div className="week-banner">
        <div>
          <h2>Full week</h2>
          <p>
            {total} events ranked for your lanes
            {total ? " · jump into a day anytime" : ""}
          </p>
        </div>
      </div>

      {weekByDay.map(({ day, events: dayEvents }) => (
        <section key={day.key} className="week-day">
          <header className="week-day-head">
            <div>
              <h2>
                {day.key} · {day.date}
              </h2>
              <p>{dayEvents.length} events</p>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => onJumpDay(day.key)}
            >
              Open day
            </button>
          </header>

          {dayEvents.length ? (
            <div className="week-slots">
              {SLOTS.map((slot) => {
                const items = dayEvents.filter((e) => e.slot === slot.key);
                if (!items.length) return null;
                return (
                  <div key={slot.key} className="week-slot">
                    <h3>{slot.label}</h3>
                    <div className="cards compact">
                      {items.map((event, i) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          rank={i + 1}
                          compact
                          saved={savedIds.includes(event.id)}
                          onToggle={() => onToggle(event.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">No events for these filters.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function MyPlan({
  events,
  savedIds,
  onToggle,
  onExport,
  onSeed,
}: {
  events: EventItem[];
  savedIds: number[];
  onToggle: (id: number) => void;
  onExport: () => void;
  onSeed: () => void;
}) {
  if (!events.length) {
    return (
      <div className="empty-plan">
        <h2>Nothing saved yet</h2>
        <p>Star events from the timeline to build your itinerary.</p>
        <button type="button" className="primary" onClick={onSeed}>
          Add founder shortlist
        </button>
      </div>
    );
  }

  return (
    <div className="my-plan">
      <div className="plan-banner">
        <div>
          <h2>{events.length} events saved</h2>
          <p>Export a self-contained HTML file you can open offline or send.</p>
        </div>
        <button type="button" className="primary" onClick={onExport}>
          Export HTML itinerary
        </button>
      </div>

      {DAYS.map((day) => {
        const dayEvents = events.filter((e) => e.weekday === day.key);
        if (!dayEvents.length) return null;
        return (
          <section key={day.key} className="slot-block">
            <header className="slot-head">
              <h2>
                {day.key} · {day.date}
              </h2>
              <span>{dayEvents.length}</span>
            </header>
            <div className="cards">
              {SLOTS.flatMap((slot) =>
                dayEvents
                  .filter((e) => e.slot === slot.key)
                  .map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      rankLabel={slot.label}
                      saved={savedIds.includes(event.id)}
                      onToggle={() => onToggle(event.id)}
                    />
                  ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EventCard({
  event,
  rank,
  rankLabel,
  saved,
  onToggle,
  compact = false,
}: {
  event: EventItem;
  rank?: number;
  rankLabel?: string;
  saved: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <article
      className={[
        "event-card",
        saved ? "saved" : "",
        compact ? "compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="event-main">
        <div className="event-top">
          <span className="emoji">{event.emoji || "•"}</span>
          {rankLabel && <span className="rank">{rankLabel}</span>}
          {typeof rank === "number" && !rankLabel && (
            <span className="rank">#{rank}</span>
          )}
          {event.tier && <span className={`tier ${event.tier}`}>{event.tier}</span>}
          {!event.hasRealVenue && <span className="rank">venue tba</span>}
        </div>
        <h3>{event.title}</h3>
        <p className="loc">{event.location || "Venue TBA"}</p>
        {!compact && (
          <>
            <div className="tag-row">
              {event.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            {event.why && <p className="why">{event.why}</p>}
          </>
        )}
      </div>
      <div className="event-actions">
        <button
          type="button"
          className={saved ? "star on" : "star"}
          onClick={onToggle}
          aria-pressed={saved}
          aria-label={saved ? "Remove from plan" : "Add to plan"}
        >
          {saved ? "★" : "☆"}
        </button>
        <a href={event.url} target="_blank" rel="noopener noreferrer">
          Open
        </a>
      </div>
    </article>
  );
}
