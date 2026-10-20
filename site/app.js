"use strict";

// ---------------------------------------------------------------- config
// Managers and their colours (the colours live in style.css as --m-<name>).
const MANAGERS = ["Anders", "Micke", "Danne"];
const MEDALS = ["🥇", "🥈", "🥉"];

// ---------------------------------------------------------------- utils
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (x) => (x == null || !isFinite(x) ? "" : Math.round(x).toLocaleString("en-US"));
const dollars = (x) => (x == null || !isFinite(x) ? "" : "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const mgrVar = (m) => (MANAGERS.includes(m) ? `var(--m-${m.toLowerCase()})` : "var(--m-other)");
const cmp = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "sv", { numeric: true }));

const NUMERIC = new Set(["Points", "World_Rank", "League_Rank", "Best_Day", "Value"]);

// Tab-separated file -> array of row objects. Columns with an empty header are dropped.
function parseTsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const head = lines[0].split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row = {};
    head.forEach((h, i) => {
      if (!h) return;
      const v = (cells[i] ?? "").trim();
      row[h] = NUMERIC.has(h) ? (v === "" ? null : Number(v)) : v;
    });
    return row;
  });
}

async function loadTsv(name) {
  const res = await fetch(`data/${name}.tsv`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`data/${name}.tsv: ${res.status}`);
  return parseTsv(await res.text());
}

// ---------------------------------------------------------------- results
// Winner = lowest world rank in each season. Sorted newest season first, then by rank.
function addResult(rows, rankCol) {
  const best = {};
  for (const r of rows) best[r.Season] = Math.min(best[r.Season] ?? Infinity, r[rankCol]);
  for (const r of rows) r.Result = r[rankCol] === best[r.Season] ? "winner" : "loser";
  return rows.sort((a, b) => cmp(b.Season, a.Season) || a[rankCol] - b[rankCol]);
}

// Playoff standing: any position in a Winner league beats any position in a
// Looser league; within the same bracket the better league rank wins.
function addPlayoffResult(rows) {
  for (const r of rows) r.Bracket = /^winner/i.test(r.League) ? "Winner" : "Loser";
  rows.sort((a, b) => cmp(b.Season, a.Season) || (a.Bracket !== "Winner") - (b.Bracket !== "Winner")
    || a.League_Rank - b.League_Rank || a.World_Rank - b.World_Rank);
  let season = null, pos = 0;
  for (const r of rows) {
    pos = r.Season === season ? pos + 1 : 1;
    season = r.Season;
    r.Pos = pos;
    r.Result = pos === 1 ? "winner" : "loser";
  }
  return rows;
}

const latestSeason = (rows) => rows.reduce((m, r) => (m == null || cmp(r.Season, m) > 0 ? r.Season : m), null);

// Top three managers of the latest season (each manager's best team only).
function podiumData(rows, rankCol) {
  const latest = latestSeason(rows);
  const seen = new Set();
  return rows.filter((r) => r.Season === latest)
    .sort((a, b) => a[rankCol] - b[rankCol])
    .filter((r) => !seen.has(r.Manager) && seen.add(r.Manager))
    .slice(0, 3);
}

// Number of seasons each manager won.
function marathonWins(rows, rankCol) {
  const best = {};
  for (const r of rows) if (!best[r.Season] || r[rankCol] < best[r.Season][rankCol]) best[r.Season] = r;
  const wins = {};
  for (const r of Object.values(best)) wins[r.Manager] = (wins[r.Manager] || 0) + 1;
  return Object.entries(wins).map(([Manager, Wins]) => ({ Manager, Wins }))
    .sort((a, b) => b.Wins - a.Wins || cmp(a.Manager, b.Manager));
}

// ---------------------------------------------------------------- highlights
function podiumHtml(pod, heading, detail) {
  return `<div class="sec-head">${esc(heading)}</div>
    <div class="podium">${pod.map((r, i) => `
      <div class="podium-item" style="background:${mgrVar(r.Manager)}">
        <div class="podium-medal">${MEDALS[i]}</div>
        <div class="podium-name">${esc(r.Manager)}</div>
        <div class="podium-detail">${esc(detail(r))}</div>
      </div>`).join("")}
    </div>`;
}

function marathonHtml(mar, heading = "Marathon — all-time wins") {
  return `<div class="sec-head">${esc(heading)}</div>
    <div>${mar.map((m) => `
      <div class="mar-row">
        <div class="mar-dot" style="background:${mgrVar(m.Manager)}">${esc(m.Manager.slice(0, 1))}</div>
        <span class="mar-name">${esc(m.Manager)}</span>
        <span class="mar-wins">${m.Wins} ${m.Wins === 1 ? "win" : "wins"}</span>
      </div>`).join("")}
    </div>`;
}

function renderHighlights(D) {
  const worldRank = (r) => `world rank: ${int(r.World_Rank)}`;
  const col = (title, parts) => `<div class="top-col"><div class="top-col-title">${title}</div>${parts.join("<hr>")}</div>`;
  $("#highlights").innerHTML = [
    col("🏒 Rosterrier", [
      podiumHtml(podiumData(D.rosterrier, "World_Rank"), `${latestSeason(D.rosterrier)} — latest season`, worldRank),
      marathonHtml(marathonWins(D.rosterrier, "World_Rank")),
      podiumHtml(podiumData(D.playoffs, "Pos"), `${latestSeason(D.playoffs)} — latest playoffs`,
        (r) => `${r.Bracket} league · rank ${int(r.League_Rank)}`),
      marathonHtml(marathonWins(D.playoffs, "Pos"), "Playoffs — all-time wins"),
    ]),
    col("⚽ FPL", [
      podiumHtml(podiumData(D.fpl, "World_Rank"), `${latestSeason(D.fpl)} — latest season`, worldRank),
      marathonHtml(marathonWins(D.fpl, "World_Rank")),
    ]),
    col("⚡ Allsvenskan", [
      podiumHtml(podiumData(D.allsvenskan, "World_Rank"), `${latestSeason(D.allsvenskan)} — latest season`, worldRank),
      marathonHtml(marathonWins(D.allsvenskan, "World_Rank")),
    ]),
  ].join("");

  $("#legend").innerHTML = `<span>Manager colour:</span>` + MANAGERS.map((m) =>
    `<span><span class="legend-dot" style="background:${mgrVar(m)}"></span>${esc(m)}</span>`).join("");
}

// ---------------------------------------------------------------- tables
// col: { key, label, right?, fmt?, cls? (value -> class) }
const C = {
  season: { key: "Season", label: "Season" },
  manager: { key: "Manager", label: "Manager", cls: () => "mgr" },
  team: { key: "Team", label: "Team" },
  league: { key: "League", label: "League" },
  worldRank: { key: "World_Rank", label: "World rank", right: true, fmt: int },
  leagueRank: { key: "League_Rank", label: "League rank", right: true, fmt: int },
  points: { key: "Points", label: "Points", right: true, fmt: int },
  result: { key: "Result", label: "Result", cls: (v) => "res-" + v },
};

function makeTabs(D) {
  return [
    {
      id: "rosterrier", label: "🏒 Rosterrier", rows: D.rosterrier, order: "World_Rank",
      cols: [C.season, C.manager, C.team, C.league, C.worldRank, C.leagueRank,
        { key: "Best_Day", label: "Best day", right: true, fmt: int }, C.points,
        { key: "Value", label: "Value ($)", right: true, fmt: dollars }, C.result],
    },
    {
      id: "playoffs", label: "🏒 Rosterrier playoffs", rows: D.playoffs, order: "Pos",
      note: "Winner-league teams always rank above Looser-league teams; within a bracket, league rank decides.",
      cols: [C.season, C.manager, C.team, { key: "Bracket", label: "Bracket", cls: (v) => "br-" + v.toLowerCase() },
        C.league, C.leagueRank, C.worldRank, C.points, C.result],
    },
    { id: "fpl", label: "⚽ FPL", rows: D.fpl, order: "World_Rank", cols: [C.season, C.manager, C.points, { ...C.worldRank, label: "World Rank" }, C.result] },
    { id: "allsvenskan", label: "⚡ Allsvenskan", rows: D.allsvenskan, order: "World_Rank", cols: [C.season, C.manager, C.points, { ...C.worldRank, label: "World Rank" }, C.result] },
  ];
}

const cellText = (col, r) => (col.fmt ? col.fmt(r[col.key]) : String(r[col.key] ?? ""));

function renderTable(tab, state) {
  const host = $("#tabContent");
  host.innerHTML = `${tab.note ? `<div class="note">${esc(tab.note)}</div>` : ""}
    <div class="tbl-tools"><label>Search:<input type="search" id="q" value="${esc(state.q)}" autocomplete="off"></label></div>
    <div class="tbl-wrap"><table><thead><tr>${tab.cols.map((c, i) =>
      `<th data-i="${i}" class="${c.right ? "r" : ""}" tabindex="0"${state.sort && state.sort.key === c.key ? ` aria-sort="${state.sort.dir > 0 ? "ascending" : "descending"}"` : ""}>${esc(c.label)}</th>`).join("")}
    </tr></thead><tbody></tbody></table></div>`;

  const draw = () => {
    // Default order: newest season first, then best rank (as in the original app).
    let rows = [...tab.rows].sort((a, b) => cmp(b.Season, a.Season) || cmp(a[tab.order], b[tab.order]));
    const s = state.sort;
    if (s) rows.sort((a, b) => s.dir * cmp(a[s.key] ?? "", b[s.key] ?? ""));
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      rows = rows.filter((r) => {
        const text = tab.cols.map((c) => cellText(c, r)).join(" ").toLowerCase();
        return words.every((w) => text.includes(w));
      });
    }
    $("tbody", host).innerHTML = rows.length ? rows.map((r) => `<tr>${tab.cols.map((c) => {
      const cls = [c.right ? "r" : "", c.cls ? c.cls(r[c.key]) : ""].filter(Boolean).join(" ");
      const style = c.key === "Manager" ? ` style="--mgr:${mgrVar(r.Manager)}"` : "";
      return `<td${cls ? ` class="${cls}"` : ""}${style}>${esc(cellText(c, r))}</td>`;
    }).join("")}</tr>`).join("")
      : `<tr><td colspan="${tab.cols.length}" class="empty">No matching records found</td></tr>`;
  };

  $("#q", host).addEventListener("input", (e) => { state.q = e.target.value; draw(); });
  const sortBy = (th) => {
    const col = tab.cols[th.dataset.i];
    const s = state.sort;
    // Ascending on first click, then toggle (like DataTables).
    state.sort = s && s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: 1 };
    renderTable(tab, state);
  };
  host.querySelectorAll("th").forEach((th) => {
    th.addEventListener("click", () => sortBy(th));
    th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortBy(th); } });
  });
  draw();
}

function setupTabs(tabs) {
  const states = Object.fromEntries(tabs.map((t) => [t.id, { q: "", sort: null }]));
  const nav = $("#tabs");
  nav.innerHTML = tabs.map((t) => `<button type="button" role="tab" data-id="${t.id}">${esc(t.label)}</button>`).join("");
  const show = (id) => {
    const tab = tabs.find((t) => t.id === id) || tabs[0];
    nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === tab.id)));
    renderTable(tab, states[tab.id]);
  };
  nav.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    history.replaceState(null, "", "#" + b.dataset.id);
    show(b.dataset.id);
  });
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
}

// ---------------------------------------------------------------- theme
function setupTheme() {
  let saved = null;
  try { saved = localStorage.getItem("smallworld.theme"); } catch { /* ignore */ }
  if (saved) document.documentElement.dataset.theme = saved;
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("smallworld.theme", next); } catch { /* ignore */ }
  });
}

// ---------------------------------------------------------------- main
async function main() {
  setupTheme();
  try {
    const [roster, fpl, allsvenskan] = await Promise.all(["rosterrier", "fpl", "allsvenskan"].map(loadTsv));
    // Rosterrier mixes regular season and playoff rows (Playoff = "Yes"/"No").
    const D = {
      rosterrier: addResult(roster.filter((r) => r.Playoff !== "Yes"), "World_Rank"),
      playoffs: addPlayoffResult(roster.filter((r) => r.Playoff === "Yes")),
      fpl: addResult(fpl, "World_Rank"),
      allsvenskan: addResult(allsvenskan, "World_Rank"),
    };
    renderHighlights(D);
    setupTabs(makeTabs(D));
  } catch (err) {
    $("#highlights").innerHTML = `<p class="error">Could not load the data: ${esc(err.message)}</p>`;
    console.error(err);
  }
}

main();
