import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvLine(lines[i]);
    const o = {};
    headers.forEach((h, j) => {
      o[h] = row[j] ?? "";
    });
    rows.push(o);
  }
  return rows;
}

function splitCsvLine(line) {
  const row = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
      continue;
    }
    if (ch === "," && !q) {
      row.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  row.push(cur);
  return row;
}

const csv = fs.readFileSync(
  "C:/Users/ulilj/Projects/chicago-tech-week-events-2026.csv",
  "utf8"
);
const short = fs.readFileSync(
  "C:/Users/ulilj/Projects/chicago-tech-week-shortlist-for-you.csv",
  "utf8"
);

const events = parseCsv(csv);
const shortlist = parseCsv(short);
const boost = Object.fromEntries(
  shortlist.map((s) => [
    s.title.toLowerCase(),
    {
      priority: Number(s.priority),
      tier: s.tier,
      slot: s.slot_guess,
      why: s.why_for_you,
    },
  ])
);

function inferTags(e) {
  const t = `${e.title} ${e.vibe_guess}`.toLowerCase();
  const tags = new Set();
  if (
    /founder|pitch|fund|vc|cap table|demo day|startup|1 million|bagel entrepreneur|passport to founders|fundraising|sparklabs/.test(
      t
    )
  ) {
    tags.add("founder");
  }
  if (
    /network|mixer|soir|kickoff|basecamp|techwalk|brunch|connection|match|party|meetup/.test(
      t
    )
  ) {
    tags.add("networker");
  }
  if (
    /ai |builder|langchain|mongodb|elastic|stripe developer|bots|quantum|pilot|product development/.test(
      t
    ) ||
    e.emoji === "🤖"
  ) {
    tags.add("builder");
  }
  if (/market|revenue|customer success|hot seat|commerce|rcs:/.test(t)) {
    tags.add("marketer");
  }
  if (e.vibe_guess === "AI") tags.add("builder");
  if (e.vibe_guess === "Networking / General") tags.add("networker");
  if (tags.size === 0) tags.add("networker");
  return [...tags];
}

function inferSlot(title, shortSlot) {
  if (shortSlot) {
    const s = shortSlot.toLowerCase();
    if (s.includes("evening") || s.includes("soir") || s.includes("party") || s.includes("dinner")) {
      return "evening";
    }
    if (s.includes("morning") || s.includes("brunch") || s.includes("kickoff")) {
      return "morning";
    }
    return "afternoon";
  }
  const t = title.toLowerCase();
  if (/brunch|bagel|1 million|kickoff|basecamp/.test(t)) return "morning";
  if (/soir|party|dinner|mixer|fest|pitch battle/.test(t)) return "evening";
  return "afternoon";
}

const out = events.map((e) => {
  const b = boost[e.title.toLowerCase()];
  return {
    id: Number(e.id),
    title: e.title,
    date: e.date || null,
    weekday: e.weekday || null,
    location: e.location,
    emoji: e.emoji,
    vibe: e.vibe_guess,
    url: e.url,
    hasRealVenue: e.has_real_venue === "true",
    dataQuality: e.data_quality,
    tags: inferTags(e),
    slot: inferSlot(e.title, b?.slot),
    founderBoost: b ? Math.max(0, 30 - b.priority) : 0,
    tier: b?.tier || null,
    why: b?.why || null,
  };
});

const dest = path.join(root, "src", "data");
fs.mkdirSync(dest, { recursive: true });
fs.writeFileSync(path.join(dest, "events.json"), JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} events (${out.filter((e) => e.founderBoost).length} boosted)`);
