const HOME_LOCATOR = "JO72SG";
const DATA_URL = "data/qso.latest.json";
const WORLD_110M_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
const WORLD_50M_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
const VIEW_STORAGE_KEY = "sp3fck-hammap-view";
const TABLE_VISIBLE_ROWS = 30;
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const EARTH_RADIUS_KM = 6371;

const CONTINENTS = {
  EU: "Europe",
  AS: "Asia",
  AF: "Africa",
  NA: "North America",
  SA: "South America",
  OC: "Oceania",
  AN: "Antarctica"
};
const CONTINENT_ORDER = ["EU", "AS", "AF", "NA", "SA", "OC", "AN"];
const WAC_CONTINENTS = ["EU", "AS", "AF", "NA", "SA", "OC"];

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
const HF_MIN_METERS = 10;
const PHONE_MODES = new Set(["SSB", "USB", "LSB", "AM", "FM", "DV", "C4FM", "DSTAR", "DMR", "DIGITALVOICE"]);

// QRZ country names that do not match the ARRL entity names after normalization.
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

const MAP_COLORS = {
  oceanLight: "#18394d",
  oceanDark: "#07121b",
  land: "#2d4553",
  coast: "rgba(165, 200, 215, 0.55)",
  landStroke: "rgba(150, 180, 195, 0.3)",
  graticule: "rgba(157, 176, 193, 0.13)",
  home: "#f1b24a",
  cq: "#f1b24a",
  cqFill: "rgba(241, 178, 74, 0.17)",
  itu: "#c49bff",
  ituFill: "rgba(196, 155, 255, 0.15)",
  needed: "#ff8a8a",
  night: "rgba(2, 6, 18, 0.28)"
};

const statusEl = document.getElementById("status");
const fromEl = document.getElementById("dateFrom");
const toEl = document.getElementById("dateTo");
const bandEl = document.getElementById("bandFilter");
const modeGroupEl = document.getElementById("modeGroupFilter");
const hfOnlyEl = document.getElementById("hfOnlyFilter");
const dxccFilterEl = document.getElementById("dxccFilter");
const continentFilterEl = document.getElementById("continentFilter");
const cqFilterEl = document.getElementById("cqFilter");
const ituFilterEl = document.getElementById("ituFilter");
const instantFilterEls = [bandEl, modeGroupEl, hfOnlyEl, dxccFilterEl, continentFilterEl, cqFilterEl, ituFilterEl];
const applyBtn = document.getElementById("applyFilters");
const clearBtn = document.getElementById("clearFilters");
const refreshBtn = document.getElementById("refreshData");

const tableBodyEl = document.getElementById("qsoTableBody");
const tableCountEl = document.getElementById("tableCount");
const tableSearchEl = document.getElementById("tableSearch");
const tableModeFilterEl = document.getElementById("tableModeFilter");
const tableCountryFilterEl = document.getElementById("tableCountryFilter");
const iframeCodeEl = document.getElementById("iframeCode");
const copyIframeCodeBtn = document.getElementById("copyIframeCode");
const iframeCopyStatusEl = document.getElementById("iframeCopyStatus");

const dxccSearchEl = document.getElementById("dxccSearch");
const dxccContinentEl = document.getElementById("dxccContinent");
const dxccSortEl = document.getElementById("dxccSort");
const missingBandEl = document.getElementById("missingBand");
const missingTabsEl = document.getElementById("missingTabs");
const missingContinentsEl = document.getElementById("missingContinents");
const missingListEl = document.getElementById("missingList");

const isEmbedMode = new URLSearchParams(window.location.search).get("embed") === "1" || window.self !== window.top;

if (isEmbedMode) {
  document.body.classList.add("embed-mode");
}

const basePoint = maidenheadToLatLon(HOME_LOCATOR);
const homeCoords = [basePoint.lon, basePoint.lat];

const DXCC = (window.__HAM_DXCC__ || []).map(([code, name, prefixes, cont, cq, itu]) => ({
  code,
  name,
  prefixes,
  prefix: shortPrefix(prefixes),
  cont,
  cq,
  itu
}));
const dxccByCode = new Map(DXCC.map((entity) => [entity.code, entity]));
const dxccByName = new Map(DXCC.map((entity) => [normalizeName(entity.name), entity]));
const CQ_ZONES = window.__HAM_CQ_ZONES__ || { type: "FeatureCollection", features: [] };
const ITU_ZONES = window.__HAM_ITU_ZONES__ || { type: "FeatureCollection", features: [] };
const ZONE_KINDS = {
  cq: {
    label: "CQ",
    max: 40,
    collection: CQ_ZONES,
    byZone: new Map(CQ_ZONES.features.map((f) => [f.properties.zone, f])),
    continents: zoneContinents("cq", 40)
  },
  itu: {
    label: "ITU",
    max: 90,
    collection: ITU_ZONES,
    byZone: new Map(ITU_ZONES.features.map((f) => [f.properties.zone, f])),
    continents: zoneContinents("itu", 90)
  }
};
const zoneLookupCache = new Map();

let allQsos = [];
let filteredMainQsos = [];
let currentStats = null;
const missingState = { tab: "dxcc", band: "any", cont: "all" };

const mapState = createMapState();

applyBtn?.addEventListener("click", applyFilters);
instantFilterEls.forEach((el) => el?.addEventListener("change", applyFilters));
clearBtn?.addEventListener("click", () => {
  fromEl.value = "";
  toEl.value = "";
  bandEl.value = "all";
  if (modeGroupEl) {
    modeGroupEl.value = "all";
  }
  if (hfOnlyEl) {
    hfOnlyEl.checked = false;
  }
  [dxccFilterEl, continentFilterEl, cqFilterEl, ituFilterEl].forEach((el) => {
    if (el) {
      el.value = "all";
    }
  });
  if (tableSearchEl) {
    tableSearchEl.value = "";
  }
  if (tableModeFilterEl) {
    tableModeFilterEl.value = "all";
  }
  if (tableCountryFilterEl) {
    tableCountryFilterEl.value = "all";
  }
  applyFilters();
});
refreshBtn?.addEventListener("click", async () => {
  await loadQsoData();
  applyFilters();
});
tableSearchEl?.addEventListener("input", renderTableFromMainFiltered);
tableModeFilterEl?.addEventListener("change", renderTableFromMainFiltered);
tableCountryFilterEl?.addEventListener("change", renderTableFromMainFiltered);
copyIframeCodeBtn?.addEventListener("click", copyIframeCode);

dxccSearchEl?.addEventListener("input", () => currentStats && renderDxccMatrix(currentStats));
dxccContinentEl?.addEventListener("change", () => currentStats && renderDxccMatrix(currentStats));
dxccSortEl?.addEventListener("change", () => currentStats && renderDxccMatrix(currentStats));
missingBandEl?.addEventListener("change", () => {
  missingState.band = missingBandEl.value;
  if (currentStats) {
    renderMissing(currentStats);
  }
});
missingTabsEl?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) {
    return;
  }
  missingState.tab = button.dataset.tab;
  missingState.cont = "all";
  missingTabsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
  if (currentStats) {
    renderMissing(currentStats);
  }
});
missingContinentsEl?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cont]");
  if (!button) {
    return;
  }
  missingState.cont = button.dataset.cont;
  if (currentStats) {
    renderMissing(currentStats);
  }
});
missingListEl?.addEventListener("click", (event) => {
  const tile = event.target.closest("button[data-zone]");
  if (tile) {
    focusZone(tile.dataset.kind, Number(tile.dataset.zone));
  }
});

initializeIframeSnippet();
initializeMap();

loadQsoData().then(() => applyFilters());

async function loadQsoData() {
  setStatus("Loading data...");
  try {
    const inlinePayload = window.__HAM_MAP_QSO_DATA__;
    if (inlinePayload && Array.isArray(inlinePayload.qsos)) {
      applyPayload(inlinePayload, false);
      setStatus(`Data loaded: ${allQsos.length} QSO`);
      return;
    }

    const res = await fetch(`${DATA_URL}?ts=${Date.now()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = await res.json();
    applyPayload(payload, true);

    setStatus(`Data loaded: ${allQsos.length} QSO`);
  } catch (error) {
    console.error(error);
    allQsos = [];
    setStatus("Failed to load data.");
  }
}

function applyPayload(payload, replaceInlineCache) {
  allQsos = (Array.isArray(payload.qsos) ? payload.qsos : []).map(enrichQso);

  const uniqueBands = sortBands(new Set(allQsos.map((qso) => qso.band).filter(Boolean)));
  bandEl.innerHTML = `<option value="all">All</option>${uniqueBands
    .map((band) => `<option value="${escapeHtml(band)}">${escapeHtml(band)}</option>`)
    .join("")}`;

  hydrateLocationFilters();

  setText("statUpdated", payload.updatedAt
    ? new Date(payload.updatedAt).toLocaleString("en-GB")
    : "none");

  if (replaceInlineCache) {
    window.__HAM_MAP_QSO_DATA__ = payload;
  }
}

function hydrateLocationFilters() {
  const entities = new Map();
  const continents = new Map();
  const cqZones = new Map();
  const ituZones = new Map();
  const bump = (map, key, value) => {
    const rec = map.get(key) || { value, count: 0 };
    rec.count += 1;
    map.set(key, rec);
  };
  allQsos.forEach((qso) => {
    if (qso.entity) {
      bump(entities, qso.entity.code, qso.entity);
    }
    if (qso.continent) {
      bump(continents, qso.continent, qso.continent);
    }
    if (qso.cqZone) {
      bump(cqZones, qso.cqZone, qso.cqZone);
    }
    if (qso.ituZone) {
      bump(ituZones, qso.ituZone, qso.ituZone);
    }
  });

  fillSelect(dxccFilterEl, [...entities.entries()]
    .sort((a, b) => a[1].value.name.localeCompare(b[1].value.name))
    .map(([code, rec]) => [code, `${rec.value.name} (${rec.value.prefix}) · ${rec.count}`]));
  fillSelect(continentFilterEl, CONTINENT_ORDER
    .filter((cont) => continents.has(cont))
    .map((cont) => [cont, `${CONTINENTS[cont]} · ${continents.get(cont).count}`]));
  fillSelect(cqFilterEl, [...cqZones.keys()]
    .sort((a, b) => a - b)
    .map((zone) => [zone, `${zone} · ${ZONE_KINDS.cq.byZone.get(zone)?.properties.name || ""} · ${cqZones.get(zone).count}`]));
  fillSelect(ituFilterEl, [...ituZones.keys()]
    .sort((a, b) => a - b)
    .map((zone) => [zone, `${zone} · ${ituZones.get(zone).count} QSO`]));
}

function fillSelect(selectEl, options) {
  if (!selectEl) {
    return;
  }
  const previous = selectEl.value;
  selectEl.innerHTML = `<option value="all">All</option>${options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("")}`;
  selectEl.value = options.some(([value]) => String(value) === previous) ? previous : "all";
}

function enrichQso(qso) {
  const point = resolvePoint(qso);
  const entity = resolveEntity(qso);
  const cqZone = trustedLogZone("cq", qso.cqz, entity?.cq, point) || zoneFromLocation("cq", entity?.cq, point);
  const ituZone = trustedLogZone("itu", qso.ituz, entity?.itu, point) || zoneFromLocation("itu", entity?.itu, point);
  const logCq = validZone(qso.cqz, 40);
  const logItu = validZone(qso.ituz, 90);
  const zoneCorrected = (logCq && logCq !== cqZone) || (logItu && logItu !== ituZone);
  const continent = CONTINENTS[qso.cont] ? qso.cont : entity?.cont || "";
  const distanceKm = point ? d3.geoDistance(homeCoords, [point.lon, point.lat]) * EARTH_RADIUS_KM : null;

  return {
    ...qso,
    point,
    entity,
    cqZone,
    ituZone,
    continent,
    modeGroup: modeGroupOf(qso.mode),
    zoneCorrected: Boolean(zoneCorrected),
    distanceKm
  };
}

function resolveEntity(qso) {
  const byCode = dxccByCode.get(Number(qso.dxcc));
  if (byCode) {
    return byCode;
  }
  if (!qso.country) {
    return null;
  }
  const key = normalizeName(qso.country);
  return dxccByName.get(key) || dxccByName.get(normalizeName(COUNTRY_ALIASES[key] || "")) || null;
}

function zoneFromLocation(kind, candidates, point) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length === 1) {
    return list[0];
  }
  if (point) {
    const cacheKey = `${kind}:${point.lon.toFixed(3)},${point.lat.toFixed(3)}:${list.join(",")}`;
    if (!zoneLookupCache.has(cacheKey)) {
      zoneLookupCache.set(cacheKey, findZoneAt(kind, [point.lon, point.lat], list));
    }
    const found = zoneLookupCache.get(cacheKey);
    if (found) {
      return found;
    }
  }
  return list[0] || null;
}

function findZoneAt(kind, coords, candidates = []) {
  const { byZone, collection } = ZONE_KINDS[kind];
  const features = candidates.length
    ? candidates.map((zone) => byZone.get(zone)).filter(Boolean)
    : collection.features;
  const hit = features.find((feature) => d3.geoContains(feature, coords));
  if (hit) {
    return hit.properties.zone;
  }
  // Entity zone lists and polygons disagree in a few places; fall back to the polygon itself.
  if (candidates.length) {
    return findZoneAt(kind, coords);
  }
  return null;
}

function applyFilters() {
  const fromDate = fromEl.value ? new Date(`${fromEl.value}T00:00:00Z`) : null;
  const toDate = toEl.value ? new Date(`${toEl.value}T23:59:59Z`) : null;
  const selectedBand = bandEl.value || "all";
  const selectedModeGroup = modeGroupEl?.value || "all";
  const hfOnly = Boolean(hfOnlyEl?.checked);
  const selectedDxcc = dxccFilterEl?.value || "all";
  const selectedContinent = continentFilterEl?.value || "all";
  const selectedCq = cqFilterEl?.value || "all";
  const selectedItu = ituFilterEl?.value || "all";

  filteredMainQsos = allQsos.filter((qso) => {
    if (selectedBand !== "all" && qso.band !== selectedBand) {
      return false;
    }
    if (hfOnly && !isHfBand(qso.band)) {
      return false;
    }
    if (selectedDxcc !== "all" && String(qso.entity?.code) !== selectedDxcc) {
      return false;
    }
    if (selectedContinent !== "all" && qso.continent !== selectedContinent) {
      return false;
    }
    if (selectedCq !== "all" && String(qso.cqZone) !== selectedCq) {
      return false;
    }
    if (selectedItu !== "all" && String(qso.ituZone) !== selectedItu) {
      return false;
    }
    if (selectedModeGroup !== "all" && qso.modeGroup !== selectedModeGroup) {
      return false;
    }

    if (fromDate || toDate) {
      const qsoDate = new Date(qso.datetime);
      if (Number.isNaN(qsoDate.valueOf())) {
        return false;
      }
      if (fromDate && qsoDate < fromDate) {
        return false;
      }
      if (toDate && qsoDate > toDate) {
        return false;
      }
    }

    return true;
  });

  currentStats = computeStats(filteredMainQsos);
  renderMap(filteredMainQsos, currentStats);
  renderStats(currentStats);
  renderContinents(currentStats);
  renderBandSummary(currentStats);
  hydrateAwardControls(currentStats);
  renderDxccMatrix(currentStats);
  renderWazMatrix(currentStats);
  renderMissing(currentStats);
  hydrateTableFilters(filteredMainQsos);
  renderTableFromMainFiltered();
}

/* ── Statistics ─────────────────────────────────── */

function computeStats(qsos) {
  const stats = {
    qsos,
    bands: [],
    dxcc: new Map(),
    cq: new Map(),
    itu: new Map(),
    continents: new Map(),
    bandQso: new Map(),
    modes: new Map(),
    calls: new Set(),
    unmatched: new Map(),
    zoneCorrected: [],
    longest: null,
    hasConfirmData: false
  };

  for (const qso of qsos) {
    const band = qso.band || "?";
    stats.bandQso.set(band, (stats.bandQso.get(band) || 0) + 1);
    stats.modes.set(qso.mode || "unknown", (stats.modes.get(qso.mode || "unknown") || 0) + 1);
    if (qso.callsign) {
      stats.calls.add(qso.callsign.toUpperCase());
    }
    if (typeof qso.confirmed === "boolean") {
      stats.hasConfirmData = true;
    }
    if (qso.zoneCorrected) {
      stats.zoneCorrected.push(qso);
    }

    if (qso.entity) {
      const rec = addWorked(stats.dxcc, qso.entity.code, qso, { entity: qso.entity, zones: new Set() });
      if (qso.cqZone) {
        rec.zones.add(qso.cqZone);
      }
    } else {
      const label = qso.country || "(no country)";
      stats.unmatched.set(label, (stats.unmatched.get(label) || 0) + 1);
    }
    if (qso.cqZone) {
      addWorked(stats.cq, qso.cqZone, qso);
    }
    if (qso.ituZone) {
      addWorked(stats.itu, qso.ituZone, qso);
    }
    if (qso.continent) {
      const rec = addWorked(stats.continents, qso.continent, qso, { entities: new Set() });
      if (qso.entity) {
        rec.entities.add(qso.entity.code);
      }
    }
    if (Number.isFinite(qso.distanceKm) && (!stats.longest || qso.distanceKm > stats.longest.distanceKm)) {
      stats.longest = qso;
    }
  }

  stats.bands = sortBands(stats.bandQso.keys()).filter((band) => band !== "?");
  return stats;
}

function addWorked(map, key, qso, extra = {}) {
  let rec = map.get(key);
  if (!rec) {
    rec = { key, count: 0, confirmed: false, bands: new Map(), ...extra };
    map.set(key, rec);
  }
  rec.count += 1;
  if (qso.confirmed) {
    rec.confirmed = true;
  }
  if (qso.band) {
    let bandRec = rec.bands.get(qso.band);
    if (!bandRec) {
      bandRec = { count: 0, confirmed: false };
      rec.bands.set(qso.band, bandRec);
    }
    bandRec.count += 1;
    if (qso.confirmed) {
      bandRec.confirmed = true;
    }
  }
  return rec;
}

function renderStats(stats) {
  setText("statQso", String(stats.qsos.length));
  setText("statCalls", String(stats.calls.size));
  setHtml("statDxcc", `${stats.dxcc.size}<small> / ${DXCC.length}</small>`);
  setHtml("statWaz", `${stats.cq.size}<small> / 40</small>`);
  setHtml("statItu", `${stats.itu.size}<small> / 90</small>`);

  const wac = WAC_CONTINENTS.filter((cont) => stats.continents.has(cont)).length;
  setHtml("statCont", `${wac}<small> / 6</small>`);

  const confirmedEl = document.getElementById("statDxccConfirmed");
  if (confirmedEl) {
    if (stats.hasConfirmData) {
      const confirmed = [...stats.dxcc.values()].filter((rec) => rec.confirmed).length;
      confirmedEl.innerHTML = `${confirmed}<small> / ${stats.dxcc.size}</small>`;
      confirmedEl.title = "";
    } else {
      confirmedEl.textContent = "-";
      confirmedEl.title = "Confirmation status arrives with the next QRZ log sync.";
    }
  }

  const slots = [...stats.dxcc.values()].reduce((sum, rec) => sum + rec.bands.size, 0);
  setText("statBandSlots", String(slots));

  const topBand = [...stats.bandQso.entries()].sort((a, b) => b[1] - a[1])[0];
  setText("statTopBand", topBand ? `${topBand[0]} (${topBand[1]})` : "-");
  const topMode = [...stats.modes.entries()].sort((a, b) => b[1] - a[1])[0];
  setText("statTopMode", topMode ? `${topMode[0]} (${topMode[1]})` : "-");

  const longest = stats.longest;
  setText("statLongest", longest
    ? `${Math.round(longest.distanceKm).toLocaleString("en-GB")} km · ${longest.callsign}`
    : "-");

  const noteEl = document.getElementById("statsNote");
  if (noteEl) {
    const unmatched = [...stats.unmatched.entries()];
    const corrected = stats.zoneCorrected;
    noteEl.textContent = [
      unmatched.length
        ? `Not matched to a DXCC entity: ${unmatched.map(([name, count]) => `${name} (${count})`).join(", ")}.`
        : "",
      corrected.length
        ? `Log CQ/ITU zone ignored for ${corrected.length} QSO because it does not fit the DXCC entity (zone taken from the locator): ${corrected.slice(0, 12).map((qso) => qso.callsign).join(", ")}${corrected.length > 12 ? ", …" : ""}.`
        : ""
    ].filter(Boolean).join(" ");
  }
}

function renderContinents(stats) {
  const el = document.getElementById("continentBars");
  if (!el) {
    return;
  }
  el.innerHTML = CONTINENT_ORDER.map((cont) => {
    const total = DXCC.filter((entity) => entity.cont === cont).length;
    const rec = stats.continents.get(cont);
    const worked = rec ? rec.entities.size : 0;
    const pct = total ? (worked / total) * 100 : 0;
    return `
      <div class="cont-row">
        <span class="cont-name">${CONTINENTS[cont]} <small>${cont}</small></span>
        <span class="bar" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></span>
        <span class="cont-val">${worked} / ${total}</span>
        <span class="cont-qso">${rec ? rec.count : 0} QSO</span>
      </div>`;
  }).join("");
}

function renderBandSummary(stats) {
  const body = document.getElementById("bandSummaryBody");
  if (!body) {
    return;
  }
  if (!stats.bands.length) {
    body.innerHTML = `<tr><td class="table-empty" colspan="6">No QSO for current filters.</td></tr>`;
    return;
  }
  const perBand = stats.bands.map((band) => ({
    band,
    qso: stats.bandQso.get(band) || 0,
    dxcc: countOnBand(stats.dxcc, band),
    cq: countOnBand(stats.cq, band),
    itu: countOnBand(stats.itu, band)
  }));
  const maxDxcc = Math.max(1, ...perBand.map((row) => row.dxcc));
  body.innerHTML = perBand.map((row) => `
    <tr>
      <th scope="row"><span class="band-dot" style="--band:${bandColor(row.band)}"></span>${escapeHtml(row.band)}</th>
      <td class="num">${row.qso}</td>
      <td class="num strong">${row.dxcc}</td>
      <td class="num">${row.cq}</td>
      <td class="num">${row.itu}</td>
      <td class="bar-col"><span class="bar" aria-hidden="true"><span style="width:${((row.dxcc / maxDxcc) * 100).toFixed(1)}%;background:${bandColor(row.band)}"></span></span></td>
    </tr>`).join("");
}

function countOnBand(map, band) {
  let count = 0;
  map.forEach((rec) => {
    if (rec.bands.has(band)) {
      count += 1;
    }
  });
  return count;
}

function hydrateAwardControls(stats) {
  if (dxccContinentEl && dxccContinentEl.options.length <= 1) {
    dxccContinentEl.insertAdjacentHTML("beforeend", CONTINENT_ORDER
      .map((cont) => `<option value="${cont}">${CONTINENTS[cont]}</option>`)
      .join(""));
  }
  if (missingBandEl) {
    const bands = sortBands(new Set(allQsos.map((qso) => qso.band).filter(Boolean)))
      .filter((band) => !hfOnlyEl?.checked || isHfBand(band));
    if (!bands.includes(missingState.band)) {
      missingState.band = "any";
    }
    missingBandEl.innerHTML = `<option value="any">Any band</option>${bands
      .map((band) => `<option value="${escapeHtml(band)}">${escapeHtml(band)}</option>`)
      .join("")}`;
    missingBandEl.value = missingState.band;
  }
}

function renderDxccMatrix(stats) {
  const table = document.getElementById("dxccMatrix");
  if (!table) {
    return;
  }
  const query = normalizeName(dxccSearchEl?.value || "");
  const cont = dxccContinentEl?.value || "all";
  const sort = dxccSortEl?.value || "name";

  let rows = [...stats.dxcc.values()].filter((rec) => {
    if (cont !== "all" && rec.entity.cont !== cont) {
      return false;
    }
    if (query) {
      const hay = normalizeName(`${rec.entity.name} ${rec.entity.prefixes}`);
      return hay.includes(query);
    }
    return true;
  });

  const sorters = {
    name: (a, b) => a.entity.name.localeCompare(b.entity.name),
    qso: (a, b) => b.count - a.count,
    bands: (a, b) => b.bands.size - a.bands.size || b.count - a.count,
    prefix: (a, b) => a.entity.prefix.localeCompare(b.entity.prefix)
  };
  rows = rows.sort(sorters[sort] || sorters.name);

  const bands = stats.bands;
  const head = `
    <thead>
      <tr>
        <th scope="col">Prefix</th>
        <th scope="col">Entity</th>
        <th scope="col">Cont.</th>
        <th scope="col" class="num">CQ</th>
        <th scope="col" class="num">QSO</th>
        ${bands.map((band) => `<th scope="col" class="num band-head" style="--band:${bandColor(band)}">${escapeHtml(band)}</th>`).join("")}
      </tr>
    </thead>`;

  if (!rows.length) {
    table.innerHTML = `${head}<tbody><tr><td class="table-empty" colspan="${5 + bands.length}">No DXCC entities for current filters.</td></tr></tbody>`;
    return;
  }

  const body = rows.map((rec) => `
    <tr>
      <td class="mono">${escapeHtml(rec.entity.prefix)}</td>
      <th scope="row">${escapeHtml(rec.entity.name)}</th>
      <td>${rec.entity.cont}</td>
      <td class="num" title="CQ zones worked in this entity">${escapeHtml([...rec.zones].sort((a, b) => a - b).join(", "))}</td>
      <td class="num strong">${rec.count}</td>
      ${bands.map((band) => matrixCell(rec.bands.get(band), band)).join("")}
    </tr>`).join("");

  const foot = `
    <tfoot>
      <tr>
        <th scope="row" colspan="4">DXCC per band</th>
        <td class="num strong">${rows.length}</td>
        ${bands.map((band) => `<td class="num strong">${rows.filter((rec) => rec.bands.has(band)).length}</td>`).join("")}
      </tr>
    </tfoot>`;

  table.innerHTML = `${head}<tbody>${body}</tbody>${foot}`;
}

function renderWazMatrix(stats) {
  const table = document.getElementById("wazMatrix");
  if (!table) {
    return;
  }
  const bands = stats.bands;
  const kind = ZONE_KINDS.cq;
  const head = `
    <thead>
      <tr>
        <th scope="col" class="num">Zone</th>
        <th scope="col">Name</th>
        <th scope="col">Cont.</th>
        <th scope="col" class="num">QSO</th>
        ${bands.map((band) => `<th scope="col" class="num band-head" style="--band:${bandColor(band)}">${escapeHtml(band)}</th>`).join("")}
      </tr>
    </thead>`;

  const body = range(1, kind.max).map((zone) => {
    const rec = stats.cq.get(zone);
    const name = kind.byZone.get(zone)?.properties.name || "";
    return `
      <tr class="${rec ? "" : "needed"}">
        <td class="num strong">${zone}</td>
        <th scope="row">${escapeHtml(name)}</th>
        <td>${kind.continents[zone] || ""}</td>
        <td class="num">${rec ? rec.count : ""}</td>
        ${bands.map((band) => matrixCell(rec?.bands.get(band), band)).join("")}
      </tr>`;
  }).join("");

  const foot = `
    <tfoot>
      <tr>
        <th scope="row" colspan="3">Zones per band</th>
        <td class="num strong">${stats.cq.size}</td>
        ${bands.map((band) => `<td class="num strong">${countOnBand(stats.cq, band)}</td>`).join("")}
      </tr>
    </tfoot>`;

  table.innerHTML = `${head}<tbody>${body}</tbody>${foot}`;
}

function matrixCell(bandRec, band) {
  if (!bandRec) {
    return `<td class="cell"></td>`;
  }
  const title = `${band}: ${bandRec.count} QSO${bandRec.confirmed ? ", confirmed" : ""}`;
  return `<td class="cell on${bandRec.confirmed ? " conf" : ""}" style="--band:${bandColor(band)}" title="${escapeHtml(title)}">${bandRec.count}</td>`;
}

function renderMissing(stats) {
  if (!missingListEl || !missingContinentsEl) {
    return;
  }
  const { tab, band } = missingState;
  const isWorked = (rec) => Boolean(rec) && (band === "any" || rec.bands.has(band));
  const bandLabel = band === "any" ? "any band" : band;

  let items;
  if (tab === "dxcc") {
    items = DXCC.map((entity) => {
      const rec = stats.dxcc.get(entity.code);
      return { cont: entity.cont, worked: isWorked(rec), entity, rec };
    });
  } else {
    const kind = ZONE_KINDS[tab];
    items = range(1, kind.max).map((zone) => {
      const rec = stats[tab].get(zone);
      return { cont: kind.continents[zone] || "", worked: isWorked(rec), zone, rec };
    });
  }

  const neededByCont = new Map();
  items.forEach((item) => {
    if (!item.worked) {
      neededByCont.set(item.cont, (neededByCont.get(item.cont) || 0) + 1);
    }
  });
  const totalNeeded = items.filter((item) => !item.worked).length;
  const continents = CONTINENT_ORDER.filter((cont) => items.some((item) => item.cont === cont));
  if (missingState.cont !== "all" && !continents.includes(missingState.cont)) {
    missingState.cont = "all";
  }

  missingContinentsEl.innerHTML = [
    `<button type="button" class="chip-btn${missingState.cont === "all" ? " active" : ""}" data-cont="all">All <span>${totalNeeded}</span></button>`,
    ...continents.map((cont) => `<button type="button" class="chip-btn${missingState.cont === cont ? " active" : ""}" data-cont="${cont}">${CONTINENTS[cont]} <span>${neededByCont.get(cont) || 0}</span></button>`)
  ].join("");

  const label = tab === "dxcc" ? "DXCC entities" : tab === "cq" ? "CQ zones (WAZ)" : "ITU zones";
  const worked = items.length - totalNeeded;
  setText("missingSummary", `${worked} of ${items.length} ${label} worked on ${bandLabel} · ${totalNeeded} still needed.`);

  const shownContinents = missingState.cont === "all" ? continents : [missingState.cont];
  missingListEl.innerHTML = shownContinents.map((cont) => {
    const group = items.filter((item) => item.cont === cont);
    const needed = group.filter((item) => !item.worked);
    const heading = `<h3>${CONTINENTS[cont]} <small>${needed.length} needed of ${group.length}</small></h3>`;
    if (tab === "dxcc") {
      if (!needed.length) {
        return `<div class="missing-group">${heading}<p class="hint">All worked on ${escapeHtml(bandLabel)}.</p></div>`;
      }
      const chips = needed.map(({ entity, rec }) => {
        const otherBands = rec ? sortBands(rec.bands.keys()).join(", ") : "";
        return `
          <span class="entity-chip${otherBands ? " partial" : ""}" title="${escapeHtml(`${entity.name} · prefixes ${entity.prefixes} · CQ ${entity.cq.join(", ")} · ITU ${entity.itu.join(", ")}`)}">
            <b>${escapeHtml(entity.prefix)}</b> ${escapeHtml(entity.name)}
            <small>${otherBands ? `worked on ${escapeHtml(otherBands)}` : `CQ ${escapeHtml(entity.cq.join(", "))}`}</small>
          </span>`;
      }).join("");
      return `<div class="missing-group">${heading}<div class="entity-grid">${chips}</div></div>`;
    }
    const kind = ZONE_KINDS[tab];
    const tiles = group.map(({ zone, worked: isZoneWorked, rec }) => {
      const name = kind.byZone.get(zone)?.properties.name || "";
      const bands = rec ? sortBands(rec.bands.keys()).join(", ") : "";
      const title = `${kind.label} ${zone}${name ? ` · ${name}` : ""}${bands ? ` · worked on ${bands}` : " · not worked"}`;
      return `<button type="button" class="zone-tile${isZoneWorked ? " worked" : ""}" data-kind="${tab}" data-zone="${zone}" title="${escapeHtml(title)}"><b>${zone}</b><small>${isZoneWorked ? `${rec.bands.get(band)?.count ?? rec.count} QSO` : "needed"}</small></button>`;
    }).join("");
    return `<div class="missing-group">${heading}<div class="zone-grid">${tiles}</div></div>`;
  }).join("");
}

/* ── Map ────────────────────────────────────────── */

function createMapState() {
  const saved = readSavedView();
  return {
    type: saved.type || "globe",
    layers: {
      lines: true,
      points: true,
      cq: false,
      itu: false,
      shade: true,
      night: false,
      graticule: true,
      ...(saved.layers || {})
    },
    rotate: initialRotation(),
    transform: d3.zoomIdentity,
    width: 0,
    height: 0,
    dpr: 1,
    interacting: false,
    world110: null,
    world50: null,
    locations: [],
    linesByBand: new Map(),
    screenPoints: [],
    focus: null,
    canvas: null,
    ctx: null,
    zoom: null,
    pending: false,
    pointer: null
  };
}

function initialRotation() {
  return [-basePoint.lon, -basePoint.lat + 12, 0];
}

function readSavedView() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveView() {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ type: mapState.type, layers: mapState.layers }));
  } catch {
    // Storage may be unavailable (private mode); the view simply is not remembered.
  }
}

function initializeMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof d3 === "undefined") {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Globe with QSO paths from JO72SG");
  mapEl.prepend(canvas);
  mapState.canvas = canvas;
  mapState.ctx = canvas.getContext("2d");

  mapState.zoom = d3.zoom()
    .scaleExtent([0.6, 18])
    .on("start", () => {
      mapState.interacting = true;
      hideTooltip();
    })
    .on("zoom", onMapZoom)
    .on("end", () => {
      mapState.interacting = false;
      scheduleMapRender();
    });
  d3.select(canvas).call(mapState.zoom).on("dblclick.zoom", null);

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mapState.pointer = [event.clientX - rect.left, event.clientY - rect.top];
    if (!mapState.interacting) {
      requestAnimationFrame(updateHover);
    }
  });
  canvas.addEventListener("pointerleave", () => {
    mapState.pointer = null;
    hideTooltip();
  });

  document.querySelectorAll("[data-projection]").forEach((button) => {
    button.classList.toggle("active", button.dataset.projection === mapState.type);
    button.addEventListener("click", () => setProjection(button.dataset.projection));
  });
  document.querySelectorAll("[data-layer]").forEach((input) => {
    input.checked = Boolean(mapState.layers[input.dataset.layer]);
    input.addEventListener("change", () => {
      mapState.layers[input.dataset.layer] = input.checked;
      saveView();
      scheduleMapRender();
    });
  });
  document.getElementById("resetView")?.addEventListener("click", resetMapView);
  document.getElementById("exportPng")?.addEventListener("click", () => exportMap("png"));
  document.getElementById("exportPdf")?.addEventListener("click", () => exportMap("pdf"));

  new ResizeObserver(() => resizeMap()).observe(mapEl);
  resizeMap();
  loadWorld();
}

async function loadWorld() {
  try {
    mapState.world110 = await fetchWorld(WORLD_110M_URL);
    scheduleMapRender();
    mapState.world50 = await fetchWorld(WORLD_50M_URL);
    scheduleMapRender();
  } catch (error) {
    console.warn("Coastline data unavailable", error);
  }
}

async function fetchWorld(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const topo = await res.json();
  return {
    land: topojson.feature(topo, topo.objects.land),
    coast: topojson.mesh(topo, topo.objects.land),
    borders: topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b)
  };
}

function resizeMap() {
  const { canvas } = mapState;
  if (!canvas) {
    return;
  }
  const rect = canvas.parentElement.getBoundingClientRect();
  mapState.width = Math.max(1, rect.width);
  mapState.height = Math.max(1, rect.height);
  mapState.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(mapState.width * mapState.dpr);
  canvas.height = Math.round(mapState.height * mapState.dpr);
  canvas.style.width = `${mapState.width}px`;
  canvas.style.height = `${mapState.height}px`;
  scheduleMapRender();
}

function setProjection(type) {
  mapState.type = type;
  document.querySelectorAll("[data-projection]").forEach((button) => {
    button.classList.toggle("active", button.dataset.projection === type);
  });
  saveView();
  resetMapView();
}

function resetMapView() {
  mapState.rotate = initialRotation();
  if (mapState.canvas && mapState.zoom) {
    d3.select(mapState.canvas).call(mapState.zoom.transform, d3.zoomIdentity);
  }
  scheduleMapRender();
}

function onMapZoom(event) {
  const previous = mapState.transform;
  const next = event.transform;
  mapState.transform = next;

  if (mapState.type === "globe") {
    const source = event.sourceEvent;
    const isDrag = source && source.type !== "wheel" && !(source.touches && source.touches.length > 1);
    if (isDrag) {
      const radius = globeRadius() * next.k;
      const degPerPx = 180 / (Math.PI * radius);
      const [lambda, phi, gamma] = mapState.rotate;
      mapState.rotate = [
        lambda + (next.x - previous.x) * degPerPx,
        Math.max(-90, Math.min(90, phi - (next.y - previous.y) * degPerPx)),
        gamma
      ];
    }
  }
  scheduleMapRender();
}

function globeRadius() {
  return Math.max(40, Math.min(mapState.width, mapState.height) / 2 - 14);
}

function buildProjection() {
  const { width, height, transform, type } = mapState;
  const radius = globeRadius();

  if (type === "globe") {
    return d3.geoOrthographic()
      .rotate(mapState.rotate)
      .scale(radius * transform.k)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .precision(0.4);
  }

  const projection = type === "azimuthal"
    ? d3.geoAzimuthalEquidistant()
      .rotate([-basePoint.lon, -basePoint.lat])
      .clipAngle(179.5)
      .scale(radius / Math.PI)
    : d3.geoNaturalEarth1()
      .rotate([-basePoint.lon, 0])
      .fitSize([width - 24, height - 24], { type: "Sphere" });

  return projection
    .scale(projection.scale() * transform.k)
    .translate([transform.x + (width / 2) * transform.k, transform.y + (height / 2) * transform.k])
    .precision(0.4);
}

function scheduleMapRender() {
  if (mapState.pending || !mapState.ctx) {
    return;
  }
  mapState.pending = true;
  requestAnimationFrame(drawMap);
}

function renderMap(qsos, stats) {
  const locations = new Map();
  const linesByBand = new Map();

  qsos.forEach((qso) => {
    if (!qso.point) {
      return;
    }
    const key = `${qso.point.lon.toFixed(3)},${qso.point.lat.toFixed(3)}`;
    let loc = locations.get(key);
    if (!loc) {
      loc = { coords: [qso.point.lon, qso.point.lat], qsos: [], bandCounts: new Map() };
      locations.set(key, loc);
    }
    loc.qsos.push(qso);
    loc.bandCounts.set(qso.band, (loc.bandCounts.get(qso.band) || 0) + 1);

    const band = qso.band || "?";
    if (!linesByBand.has(band)) {
      linesByBand.set(band, new Map());
    }
    linesByBand.get(band).set(key, loc.coords);
  });

  mapState.locations = [...locations.values()].map((loc) => {
    loc.qsos.sort((a, b) => String(b.datetime || "").localeCompare(String(a.datetime || "")));
    loc.band = [...loc.bandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    loc.radius = 2.6 + Math.min(4.5, Math.log2(loc.qsos.length) * 0.9);
    return loc;
  }).sort((a, b) => b.qsos.length - a.qsos.length);
  mapState.linesByBand = new Map([...linesByBand.entries()].map(([band, coords]) => [band, [...coords.values()]]));
  mapState.stats = stats;

  renderLegend(stats);
  scheduleMapRender();
}

function renderLegend(stats) {
  const legendEl = document.getElementById("mapLegend");
  if (!legendEl) {
    return;
  }
  legendEl.innerHTML = stats.bands
    .map((band) => `<span><i style="background:${bandColor(band)}"></i>${escapeHtml(band)}</span>`)
    .join("");
}

function drawMap() {
  mapState.pending = false;
  const { ctx, width, height, dpr, layers, type } = mapState;
  const projection = buildProjection();
  const path = d3.geoPath(projection, ctx);
  const isGlobe = type === "globe";
  const center = isGlobe ? [-mapState.rotate[0], -mapState.rotate[1]] : null;
  const isVisible = (coords) => !isGlobe || d3.geoDistance(coords, center) < Math.PI / 2 - 0.01;
  const sphere = { type: "Sphere" };

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const [cx, cy] = projection.translate();
  const radius = projection.scale();

  if (isGlobe) {
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.96, cx, cy, radius * 1.12);
    glow.addColorStop(0, "rgba(120, 200, 230, 0.28)");
    glow.addColorStop(1, "rgba(120, 200, 230, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.12, 0, Math.PI * 2);
    ctx.fill();
  }

  const ocean = isGlobe
    ? ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.05, cx, cy, radius)
    : ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, MAP_COLORS.oceanLight);
  ocean.addColorStop(1, MAP_COLORS.oceanDark);
  ctx.beginPath();
  path(sphere);
  ctx.fillStyle = ocean;
  ctx.fill();

  if (layers.graticule) {
    ctx.beginPath();
    path(d3.geoGraticule10());
    ctx.strokeStyle = MAP_COLORS.graticule;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // Filling 50m polygons costs 150-400 ms per frame, so the fill stays at 110m unless
  // zoomed in and idle; the sharper 50m coastline is drawn as a cheap stroke on top.
  const detail = !mapState.interacting && mapState.world50;
  const fillWorld = detail && mapState.transform.k >= 3 ? mapState.world50 : mapState.world110;
  const lineWorld = detail || mapState.world110;
  if (fillWorld) {
    ctx.beginPath();
    path(fillWorld.land);
    ctx.fillStyle = MAP_COLORS.land;
    ctx.fill();
  }
  if (lineWorld) {
    ctx.beginPath();
    path(lineWorld.coast);
    ctx.strokeStyle = MAP_COLORS.coast;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.beginPath();
    path(lineWorld.borders);
    ctx.strokeStyle = MAP_COLORS.landStroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  if (layers.night) {
    const antiSun = antipode(subsolarPoint(new Date()));
    [90, 84].forEach((radiusDeg) => {
      ctx.beginPath();
      path(d3.geoCircle().center(antiSun).radius(radiusDeg)());
      ctx.fillStyle = MAP_COLORS.night;
      ctx.fill();
    });
  }

  const stats = mapState.stats;
  if (layers.cq) {
    drawZoneLayer(ctx, path, projection, "cq", stats?.cq, isVisible);
  }
  if (layers.itu) {
    drawZoneLayer(ctx, path, projection, "itu", stats?.itu, isVisible);
  }

  if (isGlobe) {
    const shade = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.1, cx, cy, radius * 1.02);
    shade.addColorStop(0, "rgba(255, 255, 255, 0.07)");
    shade.addColorStop(0.55, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.42)");
    ctx.beginPath();
    path(sphere);
    ctx.fillStyle = shade;
    ctx.fill();
  }

  if (layers.lines) {
    ctx.lineWidth = 0.9;
    ctx.globalAlpha = mapState.interacting ? 0.25 : 0.38;
    mapState.linesByBand.forEach((targets, band) => {
      ctx.beginPath();
      path({ type: "MultiLineString", coordinates: targets.map((coords) => [homeCoords, coords]) });
      ctx.strokeStyle = bandColor(band);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  mapState.screenPoints = [];
  if (layers.points) {
    for (let i = mapState.locations.length - 1; i >= 0; i -= 1) {
      const loc = mapState.locations[i];
      if (!isVisible(loc.coords)) {
        continue;
      }
      const xy = projection(loc.coords);
      if (!xy) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], loc.radius, 0, Math.PI * 2);
      ctx.fillStyle = bandColor(loc.band);
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "rgba(5, 12, 18, 0.8)";
      ctx.stroke();
      mapState.screenPoints.push({ x: xy[0], y: xy[1], r: loc.radius, loc });
    }
  }

  if (isVisible(homeCoords)) {
    const home = projection(homeCoords);
    if (home) {
      ctx.beginPath();
      ctx.arc(home[0], home[1], 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(241, 178, 74, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(home[0], home[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = MAP_COLORS.home;
      ctx.fill();
    }
  }

  ctx.beginPath();
  path(sphere);
  ctx.strokeStyle = isGlobe ? "rgba(150, 210, 235, 0.45)" : "rgba(157, 176, 193, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  mapState.projection = projection;
  mapState.isVisible = isVisible;
}

function drawZoneLayer(ctx, path, projection, kindKey, worked, isVisible) {
  const kind = ZONE_KINDS[kindKey];
  const stroke = kindKey === "cq" ? MAP_COLORS.cq : MAP_COLORS.itu;
  const fill = kindKey === "cq" ? MAP_COLORS.cqFill : MAP_COLORS.ituFill;
  const focus = mapState.focus && mapState.focus.kind === kindKey && mapState.focus.until > Date.now()
    ? mapState.focus.zone
    : null;

  if (mapState.layers.shade && worked) {
    ctx.fillStyle = fill;
    kind.collection.features.forEach((feature) => {
      if (worked.has(feature.properties.zone)) {
        ctx.beginPath();
        path(feature);
        ctx.fill();
      }
    });
  }

  ctx.beginPath();
  kind.collection.features.forEach((feature) => path(feature));
  ctx.strokeStyle = stroke;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = kindKey === "cq" ? 1.1 : 0.8;
  ctx.setLineDash(kindKey === "cq" ? [] : [4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  if (focus) {
    const feature = kind.byZone.get(focus);
    if (feature) {
      ctx.beginPath();
      path(feature);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  const fontSize = kindKey === "cq" ? 12 : 10;
  ctx.font = `700 ${fontSize}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  kind.collection.features.forEach((feature) => {
    const { zone, label } = feature.properties;
    if (!label || !isVisible(label)) {
      return;
    }
    const xy = projection(label);
    if (!xy) {
      return;
    }
    const isWorked = worked?.has(zone);
    const text = String(zone);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(4, 10, 16, 0.85)";
    ctx.strokeText(text, xy[0], xy[1]);
    ctx.fillStyle = mapState.layers.shade && !isWorked ? MAP_COLORS.needed : stroke;
    ctx.fillText(text, xy[0], xy[1]);
  });
}

function updateHover() {
  const pointer = mapState.pointer;
  if (!pointer || mapState.interacting) {
    hideTooltip();
    return;
  }
  const [px, py] = pointer;
  let best = null;
  let bestDist = Infinity;
  for (const point of mapState.screenPoints) {
    const dist = Math.hypot(point.x - px, point.y - py);
    if (dist < point.r + 5 && dist < bestDist) {
      best = point;
      bestDist = dist;
    }
  }

  if (best) {
    showTooltip(pointer, locationTooltip(best.loc));
    return;
  }

  const zoneHtml = zoneTooltipAt(pointer);
  if (zoneHtml) {
    showTooltip(pointer, zoneHtml);
  } else {
    hideTooltip();
  }
}

function locationTooltip(loc) {
  const first = loc.qsos[0];
  const where = [first.entity?.name || first.country, first.grid?.toUpperCase()].filter(Boolean).join(" · ");
  const meta = [
    Number.isFinite(first.distanceKm) ? `${Math.round(first.distanceKm).toLocaleString("en-GB")} km` : null,
    first.cqZone ? `CQ ${first.cqZone}` : null,
    first.ituZone ? `ITU ${first.ituZone}` : null
  ].filter(Boolean).join(" · ");
  const rows = loc.qsos.slice(0, 6).map((qso) => `
    <li><b>${escapeHtml(qso.callsign || "N/A")}</b> <span style="color:${bandColor(qso.band)}">${escapeHtml(qso.band || "-")}</span> ${escapeHtml(qso.mode || "")} <small>${qso.datetime ? escapeHtml(new Date(qso.datetime).toLocaleDateString("en-GB")) : ""}</small></li>`).join("");
  const more = loc.qsos.length > 6 ? `<p class="more">+${loc.qsos.length - 6} more QSO here</p>` : "";
  return `<p class="tt-title">${escapeHtml(where || "Unknown")}</p>${meta ? `<p class="tt-meta">${escapeHtml(meta)}</p>` : ""}<ul>${rows}</ul>${more}`;
}

function zoneTooltipAt(pointer) {
  const { layers, projection } = mapState;
  if (!projection || (!layers.cq && !layers.itu)) {
    return "";
  }
  const coords = projection.invert(pointer);
  if (!coords || !Number.isFinite(coords[0]) || !mapState.isVisible(coords)) {
    return "";
  }
  return ["cq", "itu"]
    .filter((kindKey) => layers[kindKey])
    .map((kindKey) => {
      const zone = findZoneAt(kindKey, coords);
      if (!zone) {
        return "";
      }
      const kind = ZONE_KINDS[kindKey];
      const rec = mapState.stats?.[kindKey].get(zone);
      const name = kind.byZone.get(zone)?.properties.name || "";
      const status = rec
        ? `worked · ${rec.count} QSO · ${sortBands(rec.bands.keys()).join(", ")}`
        : "not worked yet";
      return `<p class="tt-title">${kind.label} zone ${zone}</p>${name ? `<p class="tt-meta">${escapeHtml(name)}</p>` : ""}<p class="${rec ? "tt-ok" : "tt-needed"}">${escapeHtml(status)}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function showTooltip([x, y], html) {
  const tooltip = document.getElementById("mapTooltip");
  if (!tooltip) {
    return;
  }
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const maxX = mapState.width - tooltip.offsetWidth - 8;
  const maxY = mapState.height - tooltip.offsetHeight - 8;
  tooltip.style.left = `${Math.max(8, Math.min(x + 14, maxX))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(y + 14, maxY))}px`;
}

function hideTooltip() {
  const tooltip = document.getElementById("mapTooltip");
  if (tooltip) {
    tooltip.hidden = true;
  }
}

function focusZone(kindKey, zone) {
  const kind = ZONE_KINDS[kindKey];
  const feature = kind?.byZone.get(zone);
  if (!feature) {
    return;
  }
  mapState.layers[kindKey] = true;
  document.querySelectorAll(`[data-layer="${kindKey}"]`).forEach((input) => {
    input.checked = true;
  });
  mapState.focus = { kind: kindKey, zone, until: Date.now() + 5000 };
  document.querySelector(".map-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (mapState.type === "globe") {
    const [lon, lat] = feature.properties.label;
    const target = [-lon, -lat, 0];
    const interpolate = d3.interpolate(mapState.rotate, target);
    d3.transition().duration(900).tween("rotate", () => (t) => {
      mapState.rotate = interpolate(t);
      scheduleMapRender();
    });
  } else {
    scheduleMapRender();
  }
  setTimeout(scheduleMapRender, 5100);
}

/* ── Export ─────────────────────────────────────── */

let jsPdfPromise = null;

let exportBusy = false;

async function exportMap(format) {
  if (!mapState.ctx || exportBusy) {
    return;
  }
  exportBusy = true;
  const label = format.toUpperCase();
  setStatus(`Preparing ${label}...`);
  try {
    const poster = renderPoster();
    const fileName = `sp3fck-ham-map-${new Date().toISOString().slice(0, 10)}`;
    if (format === "png") {
      const blob = await new Promise((resolve) => poster.toBlob(resolve, "image/png"));
      downloadBlob(blob, `${fileName}.png`);
    } else {
      const { jsPDF } = await loadJsPdf();
      const pdf = new jsPDF({ orientation: poster.width >= poster.height ? "landscape" : "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const fit = Math.min((pageW - margin * 2) / poster.width, (pageH - margin * 2) / poster.height);
      const w = poster.width * fit;
      const h = poster.height * fit;
      pdf.setFillColor(11, 18, 24);
      pdf.rect(0, 0, pageW, pageH, "F");
      pdf.addImage(poster.toDataURL("image/jpeg", 0.92), "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
      downloadBlob(pdf.output("blob"), `${fileName}.pdf`);
    }
    setStatus(`${label} ready: ${fileName}.${format}`);
  } catch (error) {
    console.error(error);
    setStatus(`Could not create ${label}: ${error.message || error}`);
  } finally {
    exportBusy = false;
  }
}

function renderPoster() {
  const { canvas, width, height } = mapState;
  const scale = Math.max(2, window.devicePixelRatio || 1);
  const header = 64;
  const footer = 76;
  const previousInteracting = mapState.interacting;

  // Redraw the map at export resolution, with full-detail coastlines.
  mapState.dpr = scale;
  mapState.interacting = false;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  drawMap();

  const poster = document.createElement("canvas");
  poster.width = Math.round(width * scale);
  poster.height = Math.round((height + header + footer) * scale);
  const ctx = poster.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#0b1218";
  ctx.fillRect(0, 0, width, height + header + footer);
  ctx.drawImage(canvas, 0, header, width, height);

  const pad = 18;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#e6edf3";
  ctx.font = '700 22px "Space Grotesk", sans-serif';
  ctx.fillText(`SP3FCK · ${HOME_LOCATOR}`, pad, 32);
  ctx.fillStyle = "#9db0c1";
  ctx.font = '400 12px "IBM Plex Mono", monospace';
  ctx.fillText(fitText(ctx, filterSummary(), width - pad * 2), pad, 52);
  ctx.textAlign = "right";
  const view = document.querySelector("[data-projection].active")?.textContent || "";
  ctx.fillText(`${view} view · ${new Date().toLocaleDateString("en-GB")}`, width - pad, 32);

  const stats = currentStats;
  if (stats) {
    const wac = WAC_CONTINENTS.filter((cont) => stats.continents.has(cont)).length;
    const line = [
      `${stats.qsos.length} QSO`,
      `DXCC ${stats.dxcc.size}/${DXCC.length}`,
      `WAZ ${stats.cq.size}/40`,
      `ITU ${stats.itu.size}/90`,
      `WAC ${wac}/6`,
      stats.longest ? `longest ${Math.round(stats.longest.distanceKm).toLocaleString("en-GB")} km (${stats.longest.callsign})` : null
    ].filter(Boolean).join("  ·  ");
    ctx.textAlign = "left";
    ctx.fillStyle = "#e6edf3";
    ctx.font = '600 14px "Space Grotesk", sans-serif';
    ctx.fillText(fitText(ctx, line, width - pad * 2), pad, height + header + 28);

    ctx.font = '400 11px "IBM Plex Mono", monospace';
    let x = pad;
    const y = height + header + 54;
    for (const band of stats.bands) {
      const textWidth = ctx.measureText(band).width;
      if (x + textWidth + 20 > width - pad) {
        break;
      }
      ctx.beginPath();
      ctx.arc(x + 4, y - 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = bandColor(band);
      ctx.fill();
      ctx.fillStyle = "#9db0c1";
      ctx.fillText(band, x + 12, y);
      x += textWidth + 26;
    }
  }

  mapState.interacting = previousInteracting;
  resizeMap();
  return poster;
}

function filterSummary() {
  const selected = (el) => (el && el.value !== "all" ? el.options[el.selectedIndex].text.split(" · ")[0] : null);
  const parts = [];
  if (fromEl.value || toEl.value) {
    parts.push(`${fromEl.value || "start"} – ${toEl.value || "today"}`);
  }
  const band = selected(bandEl);
  const modeGroup = selected(modeGroupEl);
  const entity = selected(dxccFilterEl);
  const continent = selected(continentFilterEl);
  const cq = selected(cqFilterEl);
  const itu = selected(ituFilterEl);
  if (band) {
    parts.push(band);
  }
  if (hfOnlyEl?.checked) {
    parts.push("HF only");
  }
  if (modeGroup) {
    parts.push(modeGroup);
  }
  if (entity) {
    parts.push(entity);
  }
  if (continent) {
    parts.push(continent);
  }
  if (cq) {
    parts.push(`CQ ${cq}`);
  }
  if (itu) {
    parts.push(`ITU ${itu}`);
  }
  return parts.length ? `Filters: ${parts.join(" · ")}` : "All contacts";
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function loadJsPdf() {
  if (window.jspdf) {
    return Promise.resolve(window.jspdf);
  }
  if (!jsPdfPromise) {
    jsPdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = JSPDF_URL;
      script.onload = () => resolve(window.jspdf);
      script.onerror = () => {
        jsPdfPromise = null;
        reject(new Error("jsPDF failed to load"));
      };
      document.head.append(script);
    });
  }
  return jsPdfPromise;
}

function downloadBlob(blob, fileName) {
  if (!blob) {
    throw new Error("empty file");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  if ("download" in link) {
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
  } else {
    // In-app browsers without the download attribute: show the file so it can be saved by hand.
    window.open(url, "_blank");
  }
  // Keep the URL alive long enough for slow "Save as" dialogs.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function subsolarPoint(date) {
  const rad = Math.PI / 180;
  const days = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const meanAnomaly = (357.529 + 0.98560028 * days) * rad;
  const meanLongitude = 280.459 + 0.98564736 * days;
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * rad;
  const obliquity = (23.439 - 0.00000036 * days) * rad;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const gmstHours = (18.697374558 + 24.06570982441908 * days) % 24;
  let lon = rightAscension / rad - gmstHours * 15;
  lon = ((lon + 540) % 360) - 180;
  return [lon, declination / rad];
}

function antipode([lon, lat]) {
  return [lon > 0 ? lon - 180 : lon + 180, -lat];
}

/* ── QSO table ──────────────────────────────────── */

function hydrateTableFilters(qsos) {
  if (!tableModeFilterEl || !tableCountryFilterEl) {
    return;
  }

  const modes = [...new Set(qsos.map((qso) => qso.mode).filter(Boolean))].sort();
  const countries = [...new Set(qsos.map((qso) => qso.country).filter(Boolean))].sort();

  tableModeFilterEl.innerHTML = `<option value="all">All</option>${modes
    .map((mode) => `<option value="${escapeHtml(mode)}">${escapeHtml(mode)}</option>`)
    .join("")}`;

  tableCountryFilterEl.innerHTML = `<option value="all">All</option>${countries
    .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
    .join("")}`;
}

function renderTableFromMainFiltered() {
  if (!tableSearchEl || !tableModeFilterEl || !tableCountryFilterEl || !tableBodyEl || !tableCountEl) {
    return;
  }

  const query = (tableSearchEl.value || "").trim().toLowerCase();
  const modeFilter = tableModeFilterEl.value || "all";
  const countryFilter = tableCountryFilterEl.value || "all";

  const tableRows = filteredMainQsos.filter((qso) => {
    if (modeFilter !== "all" && qso.mode !== modeFilter) {
      return false;
    }
    if (countryFilter !== "all" && qso.country !== countryFilter) {
      return false;
    }
    if (query) {
      const hay = `${qso.callsign || ""} ${qso.country || ""}`.toLowerCase();
      return hay.includes(query);
    }
    return true;
  });

  tableRows.sort((a, b) => String(b.datetime || "").localeCompare(String(a.datetime || "")));
  renderTable(tableRows);
}

function renderTable(qsos) {
  if (!tableBodyEl || !tableCountEl) {
    return;
  }

  tableCountEl.textContent = String(qsos.length);

  if (qsos.length === 0) {
    tableBodyEl.innerHTML = `<tr><td class="table-empty" colspan="9">No rows for current filters.</td></tr>`;
    return;
  }

  tableBodyEl.innerHTML = qsos.map((qso) => {
    const dateText = qso.datetime ? new Date(qso.datetime).toLocaleString("en-GB") : "-";
    const distance = Number.isFinite(qso.distanceKm) ? Math.round(qso.distanceKm).toLocaleString("en-GB") : "-";
    return `
      <tr>
        <td>${escapeHtml(dateText)}</td>
        <td>${escapeHtml(qso.callsign || "-")}</td>
        <td>${escapeHtml(qso.band || "-")}</td>
        <td>${escapeHtml(qso.mode || "-")}</td>
        <td>${escapeHtml(qso.country || "-")}</td>
        <td>${escapeHtml(qso.cqZone || "-")}</td>
        <td>${escapeHtml(qso.ituZone || "-")}</td>
        <td>${escapeHtml(qso.grid || "-")}</td>
        <td>${escapeHtml(distance)}</td>
      </tr>
    `;
  }).join("");
  limitTableHeight();
}

function limitTableHeight() {
  const wrap = tableBodyEl?.closest(".qso-table-wrap");
  const head = wrap?.querySelector("thead");
  const row = tableBodyEl?.rows[0];
  if (!wrap || !head || !row) {
    return;
  }
  wrap.style.maxHeight = `${Math.ceil(head.offsetHeight + row.offsetHeight * TABLE_VISIBLE_ROWS) + 2}px`;
}

/* ── Helpers ────────────────────────────────────── */

function zoneContinents(key, max) {
  const counts = Array.from({ length: max + 1 }, () => ({}));
  DXCC.forEach((entity) => {
    entity[key].forEach((zone) => {
      if (zone >= 1 && zone <= max && entity.cont) {
        counts[zone][entity.cont] = (counts[zone][entity.cont] || 0) + 1;
      }
    });
  });
  return counts.map((byCont) => Object.entries(byCont).sort((a, b) => b[1] - a[1])[0]?.[0] || "");
}

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

function shortPrefix(prefixes) {
  const list = String(prefixes || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (list.length <= 3) {
    return list.join(", ");
  }
  return `${list.slice(0, 3).join(", ")}…`;
}

// Log zones come from the other station's QRZ profile and are sometimes wrong
// (e.g. a Spanish station logged in CQ 31). Keep one only if the DXCC entity allows it
// or the locator really lies in that zone (the ARRL lists miss a few, e.g. IG9 in ITU 37).
function trustedLogZone(kind, value, entityZones, point) {
  const zone = validZone(value, ZONE_KINDS[kind].max);
  if (!zone) {
    return null;
  }
  if (!Array.isArray(entityZones) || !entityZones.length || entityZones.includes(zone)) {
    return zone;
  }
  const feature = ZONE_KINDS[kind].byZone.get(zone);
  return point && feature && d3.geoContains(feature, [point.lon, point.lat]) ? zone : null;
}

function validZone(value, max) {
  const zone = Number(value);
  return Number.isInteger(zone) && zone >= 1 && zone <= max ? zone : null;
}

function modeGroupOf(mode) {
  const value = String(mode || "").toUpperCase();
  if (value === "CW") {
    return "cw";
  }
  if (!value || PHONE_MODES.has(value)) {
    return "phone";
  }
  return "digital";
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

function isHfBand(band) {
  return bandMeters(band) >= HF_MIN_METERS;
}

function sortBands(bands) {
  return [...bands].sort((a, b) => bandMeters(b) - bandMeters(a));
}

function bandColor(band) {
  return BAND_COLORS[band] || "#9db0c1";
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  lat += Number(loc[3]) * 1;

  if (loc.length >= 6) {
    lon += (loc.charCodeAt(4) - A) * (5 / 60);
    lat += (loc.charCodeAt(5) - A) * (2.5 / 60);
    lon += (5 / 60) / 2;
    lat += (2.5 / 60) / 2;
  } else {
    lon += 1;
    lat += 0.5;
  }

  return { lat, lon };
}

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function initializeIframeSnippet() {
  if (!iframeCodeEl) {
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/ham-map\.html$/i, "ham-map-qrz.html");
  url.search = "";
  iframeCodeEl.value = `<iframe src="${url}" title="SP3FCK Ham Map" loading="lazy" style="width:100%;height:900px;border:0;border-radius:12px;overflow:hidden;"></iframe>`;
}

async function copyIframeCode() {
  if (!iframeCodeEl) {
    return;
  }

  try {
    await navigator.clipboard.writeText(iframeCodeEl.value);
    setIframeCopyStatus("Iframe code copied.");
  } catch {
    iframeCodeEl.select();
    document.execCommand("copy");
    setIframeCopyStatus("Iframe code copied (fallback).");
  }
}

function setIframeCopyStatus(message) {
  if (iframeCopyStatusEl) {
    iframeCopyStatusEl.textContent = message;
  }
}
