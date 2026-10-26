// Renders ham-map-qrz.html: a static, JavaScript-free page for the QRZ.com iframe.
// The map mirrors the "Flat" view of ham-map.html (Natural Earth projection, CQ zones,
// great-circle paths coloured by band) and the page carries DXCC / WAZ / ITU totals.
//
// Used by scripts/qrz-sync.mjs after each log sync. Run it directly to rebuild the page
// from the committed data/qso.latest.json without calling the QRZ API:
//   npm install --no-save d3-geo@3 topojson-client@3
//   node scripts/qrz-static-page.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoContains, geoDistance, geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

const WORLD_URL = process.env.WORLD_ATLAS_URL || "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
const DEFAULT_LOCATOR = "JO72SG";
const WIDTH = 1200;
const HEIGHT = 620;
const EARTH_RADIUS_KM = 6371;

const BAND_COLORS = {
  "160m": "#b48cff",
  "80m": "#7f9cff",
  "60m": "#5bb2ff",
  "40m": "#3ecfcf",
  "30m": "#4fd18b",
  "20m": "#a6e35a",
  "17m": "#e8e357",
  "15m": "#f5c04a",
  "12m": "#f59a4a",
  "10m": "#f56f6f",
  "6m": "#f25ca8",
  "4m": "#e07ad8",
  "2m": "#f2f2f2",
  "70cm": "#c9c9c9",
  "23cm": "#a8a8a8"
};

// Same aliases as assets/js/ham-map.js: QRZ country names that differ from ARRL entity names.
const COUNTRY_ALIASES = {
  "united states": "United States of America",
  "usa": "United States of America",
  "russia": "European Russia",
  "slovak republic": "Slovakia",
  "czechia": "Czech Republic",
  "madeira island": "Madeira",
  "madeira islands": "Madeira",
  "congo": "Republic of the Congo",
  "dem rep of the congo": "Democratic Republic of the Congo",
  "bosnia and herzegovina": "Bosnia-Herzegovina",
  "macedonia": "North Macedonia",
  "fed rep of germany": "Germany",
  "federal republic of germany": "Germany",
  "korea republic of": "South Korea",
  "republic of korea": "South Korea",
  "vatican city": "Vatican",
  "european turkey": "Turkey",
  "asiatic turkey": "Turkey"
};

export async function renderQrzStaticPage(payload, rootDir = process.cwd()) {
  const locator = payload.homeLocator || DEFAULT_LOCATOR;
  const home = maidenheadToLatLon(locator);
  const homeCoords = [home.lon, home.lat];
  const reference = await loadReference(rootDir);
  const world = await loadWorld();
  const qsos = (Array.isArray(payload.qsos) ? payload.qsos : []).map((qso) => enrichQso(qso, reference, homeCoords));
  const stats = computeStats(qsos);
  const map = renderMapSvg(qsos, stats, reference, world, homeCoords, locator);
  return renderPage(payload, locator, qsos, stats, reference, map);
}

/* ── Data ─────────────────────────────────────── */

async function loadReference(rootDir) {
  const readGlobal = async (file) => {
    const text = await fs.readFile(path.join(rootDir, "data", file), "utf8");
    return JSON.parse(/=\s*([\s\S]*?);?\s*$/.exec(text)[1]);
  };
  const dxcc = (await readGlobal("dxcc-entities.js")).map(([code, name, prefixes, cont, cq, itu]) => ({
    code,
    name,
    prefixes,
    cont,
    cq,
    itu
  }));
  const cqZones = await readGlobal("cq-zones.js");
  const ituZones = await readGlobal("itu-zones.js");
  return {
    dxcc,
    byCode: new Map(dxcc.map((entity) => [entity.code, entity])),
    byName: new Map(dxcc.map((entity) => [normalizeName(entity.name), entity])),
    zones: {
      cq: { max: 40, collection: cqZones, byZone: new Map(cqZones.features.map((f) => [f.properties.zone, f])) },
      itu: { max: 90, collection: ituZones, byZone: new Map(ituZones.features.map((f) => [f.properties.zone, f])) }
    },
    zoneCache: new Map()
  };
}

async function loadWorld() {
  try {
    const res = await fetch(WORLD_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const topo = await res.json();
    return {
      land: feature(topo, topo.objects.land),
      coast: mesh(topo, topo.objects.land),
      borders: mesh(topo, topo.objects.countries, (a, b) => a !== b)
    };
  } catch (error) {
    console.warn(`Coastlines unavailable for the QRZ page (${error.message}); rendering without land.`);
    return null;
  }
}

function enrichQso(qso, reference, homeCoords) {
  const point = resolvePoint(qso);
  const countryKey = normalizeName(qso.country);
  const entity = reference.byCode.get(Number(qso.dxcc))
    || reference.byName.get(countryKey)
    || reference.byName.get(normalizeName(COUNTRY_ALIASES[countryKey] || ""))
    || null;
  return {
    ...qso,
    point,
    entity,
    dxccKey: entity ? entity.code : countryKey || null,
    cqZone: trustedLogZone(reference, "cq", qso.cqz, entity?.cq, point) || zoneFromLocation(reference, "cq", entity?.cq, point),
    ituZone: trustedLogZone(reference, "itu", qso.ituz, entity?.itu, point) || zoneFromLocation(reference, "itu", entity?.itu, point),
    distanceKm: point ? geoDistance(homeCoords, [point.lon, point.lat]) * EARTH_RADIUS_KM : null
  };
}

function zoneFromLocation(reference, kind, candidates, point) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length === 1) {
    return list[0];
  }
  if (point) {
    const key = `${kind}:${point.lon.toFixed(3)},${point.lat.toFixed(3)}:${list.join(",")}`;
    if (!reference.zoneCache.has(key)) {
      reference.zoneCache.set(key, findZoneAt(reference, kind, [point.lon, point.lat], list));
    }
    const found = reference.zoneCache.get(key);
    if (found) {
      return found;
    }
  }
  return list[0] || null;
}

function findZoneAt(reference, kind, coords, candidates = []) {
  const { byZone, collection } = reference.zones[kind];
  const features = candidates.length ? candidates.map((zone) => byZone.get(zone)).filter(Boolean) : collection.features;
  const hit = features.find((f) => geoContains(f, coords));
  if (hit) {
    return hit.properties.zone;
  }
  return candidates.length ? findZoneAt(reference, kind, coords) : null;
}

function computeStats(qsos) {
  const stats = {
    dxcc: new Map(),
    cq: new Map(),
    itu: new Map(),
    bandQso: new Map(),
    longest: null
  };
  const add = (map, key, band) => {
    if (!key) {
      return;
    }
    const rec = map.get(key) || { count: 0, bands: new Set() };
    rec.count += 1;
    if (band) {
      rec.bands.add(band);
    }
    map.set(key, rec);
  };

  for (const qso of qsos) {
    stats.bandQso.set(qso.band || "?", (stats.bandQso.get(qso.band || "?") || 0) + 1);
    add(stats.dxcc, qso.dxccKey, qso.band);
    add(stats.cq, qso.cqZone, qso.band);
    add(stats.itu, qso.ituZone, qso.band);
    if (Number.isFinite(qso.distanceKm) && (!stats.longest || qso.distanceKm > stats.longest.distanceKm)) {
      stats.longest = qso;
    }
  }
  stats.bands = sortBands([...stats.bandQso.keys()].filter((band) => band !== "?"));
  return stats;
}

/* ── Map ──────────────────────────────────────── */

function renderMapSvg(qsos, stats, reference, world, homeCoords, locator) {
  const sphere = { type: "Sphere" };
  const projection = geoNaturalEarth1()
    .rotate([-homeCoords[0], 0])
    .fitExtent([[12, 12], [WIDTH - 12, HEIGHT - 12]], sphere)
    .precision(0.5);
  const path = geoPath(projection);
  if (typeof path.digits === "function") {
    path.digits(1);
  }
  const d = (object) => path(object) || "";
  const cq = reference.zones.cq;

  const locations = new Map();
  for (const qso of qsos) {
    if (!qso.point) {
      continue;
    }
    const key = `${qso.point.lon.toFixed(3)},${qso.point.lat.toFixed(3)}`;
    const loc = locations.get(key) || { coords: [qso.point.lon, qso.point.lat], qsos: [], bands: new Map() };
    loc.qsos.push(qso);
    loc.bands.set(qso.band, (loc.bands.get(qso.band) || 0) + 1);
    locations.set(key, loc);
  }
  const locs = [...locations.values()].map((loc) => ({
    ...loc,
    band: [...loc.bands.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }));

  const linesByBand = new Map();
  for (const loc of locs) {
    for (const band of loc.bands.keys()) {
      if (!linesByBand.has(band)) {
        linesByBand.set(band, []);
      }
      linesByBand.get(band).push([homeCoords, loc.coords]);
    }
  }

  const workedFill = cq.collection.features
    .filter((f) => stats.cq.has(f.properties.zone))
    .map((f) => d(f))
    .join("");

  const paths = sortBands([...linesByBand.keys()]).reverse().map((band) =>
    `<path d="${d({ type: "MultiLineString", coordinates: linesByBand.get(band) })}" stroke="${bandColor(band)}" />`
  ).join("\n");

  const points = locs
    .sort((a, b) => b.qsos.length - a.qsos.length)
    .map((loc) => {
      const xy = projection(loc.coords);
      if (!xy) {
        return "";
      }
      const first = loc.qsos[0];
      const r = 2.4 + Math.min(4, Math.log2(loc.qsos.length) * 0.8);
      const lines = loc.qsos
        .slice()
        .sort((a, b) => String(b.datetime || "").localeCompare(String(a.datetime || "")))
        .slice(0, 5)
        .map((qso) => `${qso.callsign || "N/A"} ${qso.band || "-"} ${qso.mode || ""}`.trim());
      const more = loc.qsos.length > 5 ? `\n+${loc.qsos.length - 5} more` : "";
      const title = `${first.entity?.name || first.country || "Unknown"} · CQ ${first.cqZone || "-"} · ITU ${first.ituZone || "-"}\n${lines.join("\n")}${more}`;
      return `<circle cx="${xy[0].toFixed(1)}" cy="${xy[1].toFixed(1)}" r="${r.toFixed(1)}" fill="${bandColor(loc.band)}"><title>${escapeHtml(title)}</title></circle>`;
    })
    .join("\n");

  const labels = cq.collection.features.map((f) => {
    const xy = projection(f.properties.label);
    if (!xy) {
      return "";
    }
    const worked = stats.cq.has(f.properties.zone);
    return `<text x="${xy[0].toFixed(1)}" y="${xy[1].toFixed(1)}" class="${worked ? "zl" : "zl needed"}"><title>CQ ${f.properties.zone} · ${escapeHtml(f.properties.name)}${worked ? "" : " · not worked"}</title>${f.properties.zone}</text>`;
  }).join("\n");

  const home = projection(homeCoords);
  const legendItems = stats.bands.map((band, i) =>
    `<g transform="translate(${24 + i * 74} ${HEIGHT - 24})"><circle r="6" fill="${bandColor(band)}" /><text x="11" y="5">${escapeHtml(band)}</text></g>`
  ).join("");

  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Map of SP3FCK contacts with CQ zones">
        <defs>
          <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#18394d" />
            <stop offset="1" stop-color="#07121b" />
          </linearGradient>
        </defs>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="#060c11" />
        <path d="${d(sphere)}" fill="url(#ocean)" />
        <path d="${d(geoGraticule10())}" fill="none" stroke="rgba(157,176,193,0.13)" stroke-width="0.6" />
        ${world ? `<path d="${d(world.land)}" fill="#2d4553" />
        <path d="${d(world.coast)}" fill="none" stroke="rgba(165,200,215,0.55)" stroke-width="0.7" />
        <path d="${d(world.borders)}" fill="none" stroke="rgba(150,180,195,0.3)" stroke-width="0.5" />` : ""}
        <path d="${workedFill}" fill="rgba(241,178,74,0.17)" />
        <path d="${cq.collection.features.map((f) => d(f)).join("")}" fill="none" stroke="#f1b24a" stroke-opacity="0.7" stroke-width="1.1" />
        <g fill="none" stroke-width="0.9" stroke-opacity="0.38">
        ${paths}
        </g>
        <g stroke="rgba(5,12,18,0.8)" stroke-width="0.8" fill-opacity="0.9">
        ${points}
        </g>
        ${home ? `<circle cx="${home[0].toFixed(1)}" cy="${home[1].toFixed(1)}" r="9" fill="none" stroke="rgba(241,178,74,0.55)" stroke-width="2" />
        <circle cx="${home[0].toFixed(1)}" cy="${home[1].toFixed(1)}" r="5" fill="#f1b24a"><title>Home locator ${escapeHtml(locator)}</title></circle>` : ""}
        <g class="zone-labels">
        ${labels}
        </g>
        <path d="${d(sphere)}" fill="none" stroke="rgba(157,176,193,0.35)" />
        <g class="legend">${legendItems}</g>
      </svg>`;
}

/* ── Page ─────────────────────────────────────── */

function renderPage(payload, locator, qsos, stats, reference, mapSvg) {
  const updated = payload.updatedAt ? new Date(payload.updatedAt).toLocaleString("en-GB") : "none";
  const longest = stats.longest
    ? `${Math.round(stats.longest.distanceKm).toLocaleString("en-GB")} km`
    : "-";
  const longestCall = stats.longest ? stats.longest.callsign : "";

  const bandRows = stats.bands.map((band) => {
    const onBand = (map) => [...map.values()].filter((rec) => rec.bands.has(band)).length;
    return `
          <tr>
            <td><span class="dot" style="background:${bandColor(band)}"></span>${escapeHtml(band)}</td>
            <td class="num">${stats.bandQso.get(band) || 0}</td>
            <td class="num strong">${onBand(stats.dxcc)}</td>
            <td class="num">${onBand(stats.cq)}</td>
            <td class="num">${onBand(stats.itu)}</td>
          </tr>`;
  }).join("");

  const zoneTiles = Array.from({ length: 40 }, (_, i) => i + 1).map((zone) => {
    const rec = stats.cq.get(zone);
    const name = reference.zones.cq.byZone.get(zone)?.properties.name || "";
    return `<span class="zone${rec ? " worked" : ""}" title="CQ ${zone} · ${escapeHtml(name)}${rec ? ` · ${rec.count} QSO` : " · needed"}">${zone}</span>`;
  }).join("");

  const latest = qsos.slice(0, 8).map((qso) => `
          <tr>
            <td>${escapeHtml(qso.datetime ? new Date(qso.datetime).toLocaleString("en-GB") : "-")}</td>
            <td>${escapeHtml(qso.callsign || "-")}</td>
            <td>${escapeHtml(qso.band || "-")}</td>
            <td>${escapeHtml(qso.mode || "-")}</td>
            <td>${escapeHtml(qso.entity?.name || qso.country || "-")}</td>
            <td class="num">${escapeHtml(qso.cqZone || "-")}</td>
            <td class="num">${escapeHtml(qso.ituZone || "-")}</td>
          </tr>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>SP3FCK | QRZ Map Embed</title>
  <style>
    :root {
      --bg: #0a0d10;
      --panel: #141d25;
      --line: #2a3642;
      --text: #e6edf3;
      --muted: #9db0c1;
      --accent: #4dd0b5;
      --accent-2: #f1b24a;
      --needed: #ff8a8a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      background: radial-gradient(900px 400px at 100% 0, rgba(77,208,181,0.08), transparent 60%), var(--bg);
      color: var(--text);
      font: 14px/1.4 "Segoe UI", Arial, sans-serif;
    }
    .shell { max-width: 1200px; margin: 0 auto; display: grid; gap: 12px; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
    h1, h2, p { margin: 0; }
    h2 { font-size: 15px; margin-bottom: 10px; }
    .title { display: flex; justify-content: space-between; gap: 12px; align-items: end; }
    .eyebrow { color: var(--accent); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin-top: 6px; color: var(--muted); }
    .stats { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 10px; }
    .card { background: #0d1319; border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
    .card.award { border-color: var(--accent-2); }
    .card .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .card .value { margin-top: 6px; font-weight: 700; font-size: 20px; }
    .card .value small { color: var(--muted); font-weight: 400; font-size: 13px; }
    .card .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .map-wrap { padding: 0; overflow: hidden; }
    svg { display: block; width: 100%; height: auto; }
    .zone-labels text { font: 700 16px "Consolas", "IBM Plex Mono", monospace; text-anchor: middle; dominant-baseline: middle; fill: #f1b24a; paint-order: stroke; stroke: rgba(4,10,16,0.85); stroke-width: 4px; }
    .zone-labels text.needed { fill: var(--needed); }
    .legend text { font: 14px "Consolas", "IBM Plex Mono", monospace; fill: var(--muted); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .zones { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
    .zone { text-align: center; padding: 6px 0; border-radius: 6px; border: 1px dashed rgba(255,138,138,0.55); color: var(--needed); font: 700 13px "Consolas", monospace; }
    .zone.worked { border: 1px solid var(--accent-2); background: rgba(241,178,74,0.16); color: var(--text); }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 7px 10px; border-bottom: 1px solid var(--line); text-align: left; }
    th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .num { text-align: right; font-family: "Consolas", monospace; }
    .strong { font-weight: 700; }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; }
    .foot { color: var(--muted); font-size: 12px; }
    .credits { color: var(--muted); font-size: 11px; text-align: right; }
    @media (max-width: 960px) {
      .stats { grid-template-columns: repeat(3, minmax(120px, 1fr)); }
    }
    @media (max-width: 760px) {
      .stats { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      .row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="panel title">
      <div>
        <p class="eyebrow">SP3FCK · ${escapeHtml(locator)}</p>
        <h1>Ham Map</h1>
        <p class="subtitle">Every contact from the log, with CQ zones. Hover a dot for callsigns.</p>
      </div>
      <p class="foot">Updated: ${escapeHtml(updated)}</p>
    </section>

    <section class="stats">
      <article class="card"><p class="label">QSO</p><p class="value">${qsos.length}</p></article>
      <article class="card award"><p class="label">DXCC</p><p class="value">${stats.dxcc.size}<small> / ${reference.dxcc.length}</small></p></article>
      <article class="card award"><p class="label">WAZ (CQ zones)</p><p class="value">${stats.cq.size}<small> / 40</small></p></article>
      <article class="card award"><p class="label">ITU zones</p><p class="value">${stats.itu.size}<small> / 90</small></p></article>
      <article class="card"><p class="label">Bands</p><p class="value">${stats.bands.length}</p></article>
      <article class="card"><p class="label">Longest QSO</p><p class="value">${escapeHtml(longest)}</p><p class="sub">${escapeHtml(longestCall)}</p></article>
    </section>

    <section class="panel map-wrap">
      ${mapSvg}
    </section>

    <div class="row">
      <section class="panel">
        <h2>Per band</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Band</th><th class="num">QSO</th><th class="num">DXCC</th><th class="num">WAZ</th><th class="num">ITU</th></tr></thead>
            <tbody>${bandRows}</tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <h2>WAZ: ${stats.cq.size} of 40 CQ zones</h2>
        <div class="zones">${zoneTiles}</div>
      </section>
    </div>

    <section class="panel">
      <h2>Latest contacts</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Callsign</th><th>Band</th><th>Mode</th><th>Country</th><th class="num">CQ</th><th class="num">ITU</th></tr>
          </thead>
          <tbody>${latest}</tbody>
        </table>
      </div>
    </section>

    <p class="credits">Zones: HB9HIL/hamradio-zones-geojson · DXCC list: k0swe/dxcc-json · Coastlines: Natural Earth</p>
  </div>
</body>
</html>
`;
}

/* ── Helpers ──────────────────────────────────── */

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Same rule as assets/js/ham-map.js: keep a log zone only if the DXCC entity allows it
// or the locator really lies in that zone.
function trustedLogZone(reference, kind, value, entityZones, point) {
  const zone = validZone(value, reference.zones[kind].max);
  if (!zone) {
    return null;
  }
  if (!Array.isArray(entityZones) || !entityZones.length || entityZones.includes(zone)) {
    return zone;
  }
  const feature = reference.zones[kind].byZone.get(zone);
  return point && feature && geoContains(feature, [point.lon, point.lat]) ? zone : null;
}

function validZone(value, max) {
  const zone = Number(value);
  return Number.isInteger(zone) && zone >= 1 && zone <= max ? zone : null;
}

function bandMeters(band) {
  const match = /^(\d+(?:\.\d+)?)(mm|cm|m)$/i.exec(String(band || ""));
  if (!match) {
    return 0;
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit === "m" ? value : unit === "cm" ? value / 100 : value / 1000;
}

function sortBands(bands) {
  return [...bands].sort((a, b) => bandMeters(b) - bandMeters(a));
}

function bandColor(band) {
  return BAND_COLORS[band] || "#9db0c1";
}

function resolvePoint(qso) {
  if (Number.isFinite(qso.lat) && Number.isFinite(qso.lon)) {
    return { lat: qso.lat, lon: qso.lon };
  }
  if (qso.grid) {
    try {
      return maidenheadToLatLon(qso.grid);
    } catch {
      return null;
    }
  }
  return null;
}

function maidenheadToLatLon(locator) {
  const loc = (locator || "").trim().toUpperCase();
  if (!/^([A-R]{2})(\d{2})([A-X]{2})?$/.test(loc)) {
    throw new Error(`Invalid locator: ${locator}`);
  }
  const A = "A".charCodeAt(0);
  let lon = (loc.charCodeAt(0) - A) * 20 - 180;
  let lat = (loc.charCodeAt(1) - A) * 10 - 90;
  lon += Number(loc[2]) * 2;
  lat += Number(loc[3]);
  if (loc.length >= 6) {
    lon += (loc.charCodeAt(4) - A) * (5 / 60) + (5 / 60) / 2;
    lat += (loc.charCodeAt(5) - A) * (2.5 / 60) + (2.5 / 60) / 2;
  } else {
    lon += 1;
    lat += 0.5;
  }
  return { lat, lon };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = process.cwd();
  const payload = JSON.parse(await fs.readFile(path.join(rootDir, "data", "qso.latest.json"), "utf8"));
  const outputPath = path.join(rootDir, "ham-map-qrz.html");
  await fs.writeFile(outputPath, await renderQrzStaticPage(payload, rootDir), "utf8");
  console.log(`Rendered ${outputPath} from data/qso.latest.json`);
}
