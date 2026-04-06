const HOME_LOCATOR = "JO72SG";
const DATA_URL = "data/qso.latest.json";

const statusEl = document.getElementById("status");
const fromEl = document.getElementById("dateFrom");
const toEl = document.getElementById("dateTo");
const bandEl = document.getElementById("bandFilter");
const applyBtn = document.getElementById("applyFilters");
const clearBtn = document.getElementById("clearFilters");
const refreshBtn = document.getElementById("refreshData");

const statQsoEl = document.getElementById("statQso");
const statCountriesEl = document.getElementById("statCountries");
const statTopBandEl = document.getElementById("statTopBand");
const statTopModeEl = document.getElementById("statTopMode");
const statUpdatedEl = document.getElementById("statUpdated");

const tableBodyEl = document.getElementById("qsoTableBody");
const tableCountEl = document.getElementById("tableCount");
const tableSearchEl = document.getElementById("tableSearch");
const tableModeFilterEl = document.getElementById("tableModeFilter");
const tableCountryFilterEl = document.getElementById("tableCountryFilter");
const iframeCodeEl = document.getElementById("iframeCode");
const copyIframeCodeBtn = document.getElementById("copyIframeCode");
const iframeCopyStatusEl = document.getElementById("iframeCopyStatus");
const isEmbedMode = new URLSearchParams(window.location.search).get("embed") === "1" || window.self !== window.top;

if (isEmbedMode) {
  document.body.classList.add("embed-mode");
}

const basePoint = maidenheadToLatLon(HOME_LOCATOR);
const map = L.map("map", { worldCopyJump: true }).setView([basePoint.lat, basePoint.lon], 3);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const lineLayer = L.layerGroup().addTo(map);

L.circleMarker([basePoint.lat, basePoint.lon], {
  radius: 7,
  color: "#f1b24a",
  fillColor: "#f1b24a",
  fillOpacity: 0.9
}).addTo(map).bindTooltip(`QTH ${HOME_LOCATOR}`);

let allQsos = [];
let filteredMainQsos = [];

applyBtn?.addEventListener("click", applyFilters);
clearBtn?.addEventListener("click", () => {
  fromEl.value = "";
  toEl.value = "";
  bandEl.value = "all";
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

initializeIframeSnippet();

loadQsoData().then(() => applyFilters());

async function loadQsoData() {
  setStatus("Loading data...");
  try {
    const res = await fetch(`${DATA_URL}?ts=${Date.now()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = await res.json();
    allQsos = Array.isArray(payload.qsos) ? payload.qsos : [];

    const uniqueBands = [...new Set(allQsos.map((qso) => qso.band).filter(Boolean))].sort();
    bandEl.innerHTML = `<option value="all">All</option>${uniqueBands
      .map((band) => `<option value="${band}">${band}</option>`)
      .join("")}`;

    statUpdatedEl.textContent = payload.updatedAt
      ? new Date(payload.updatedAt).toLocaleString("en-GB")
      : "none";

    setStatus(`Data loaded: ${allQsos.length} QSO`);
  } catch (error) {
    console.error(error);
    allQsos = [];
    setStatus("Failed to load data.");
  }
}

function applyFilters() {
  const fromDate = fromEl.value ? new Date(`${fromEl.value}T00:00:00Z`) : null;
  const toDate = toEl.value ? new Date(`${toEl.value}T23:59:59Z`) : null;
  const selectedBand = bandEl.value || "all";

  filteredMainQsos = allQsos.filter((qso) => {
    if (selectedBand !== "all" && qso.band !== selectedBand) {
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

  renderMap(filteredMainQsos);
  renderStats(filteredMainQsos);
  hydrateTableFilters(filteredMainQsos);
  renderTableFromMainFiltered();
}

function renderMap(qsos) {
  markerLayer.clearLayers();
  lineLayer.clearLayers();

  const bounds = [];
  qsos.forEach((qso) => {
    const point = resolvePoint(qso);
    if (!point) {
      return;
    }

    const marker = L.circleMarker([point.lat, point.lon], {
      radius: 5,
      color: "#4dd0b5",
      fillColor: "#4dd0b5",
      fillOpacity: 0.7
    });

    const popup = [
      `<strong>${qso.callsign || "N/A"}</strong>`,
      qso.band ? `Band: ${qso.band}` : null,
      qso.mode ? `Mode: ${qso.mode}` : null,
      qso.country ? `Country: ${qso.country}` : null,
      qso.datetime ? `Date: ${new Date(qso.datetime).toLocaleString("en-GB")}` : null
    ].filter(Boolean).join("<br>");

    marker.bindPopup(popup);
    markerLayer.addLayer(marker);

    const line = L.polyline(
      [
        [basePoint.lat, basePoint.lon],
        [point.lat, point.lon]
      ],
      {
        color: "#f1b24a",
        weight: 1,
        opacity: 0.55
      }
    );

    lineLayer.addLayer(line);
    bounds.push([point.lat, point.lon]);
  });

  if (bounds.length > 0) {
    bounds.push([basePoint.lat, basePoint.lon]);
    map.fitBounds(bounds, { padding: [24, 24] });
  } else {
    map.setView([basePoint.lat, basePoint.lon], 3);
  }
}

function renderStats(qsos) {
  statQsoEl.textContent = String(qsos.length);

  const countrySet = new Set(qsos.map((qso) => qso.country).filter(Boolean));
  statCountriesEl.textContent = String(countrySet.size);

  const bandCounts = qsos.reduce((acc, qso) => {
    const key = qso.band || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topBand = Object.entries(bandCounts).sort((a, b) => b[1] - a[1])[0];
  statTopBandEl.textContent = topBand ? `${topBand[0]} (${topBand[1]})` : "-";

  const modeCounts = qsos.reduce((acc, qso) => {
    const key = qso.mode || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0];
  statTopModeEl.textContent = topMode ? `${topMode[0]} (${topMode[1]})` : "-";
}

function hydrateTableFilters(qsos) {
  if (!tableModeFilterEl || !tableCountryFilterEl) {
    return;
  }

  const modes = [...new Set(qsos.map((qso) => qso.mode).filter(Boolean))].sort();
  const countries = [...new Set(qsos.map((qso) => qso.country).filter(Boolean))].sort();

  tableModeFilterEl.innerHTML = `<option value="all">All</option>${modes
    .map((mode) => `<option value="${mode}">${mode}</option>`)
    .join("")}`;

  tableCountryFilterEl.innerHTML = `<option value="all">All</option>${countries
    .map((country) => `<option value="${country}">${country}</option>`)
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
    tableBodyEl.innerHTML = `<tr><td class="table-empty" colspan="6">No rows for current filters.</td></tr>`;
    return;
  }

  tableBodyEl.innerHTML = qsos.map((qso) => {
    const dateText = qso.datetime ? new Date(qso.datetime).toLocaleString("en-GB") : "-";
    return `
      <tr>
        <td>${escapeHtml(dateText)}</td>
        <td>${escapeHtml(qso.callsign || "-")}</td>
        <td>${escapeHtml(qso.band || "-")}</td>
        <td>${escapeHtml(qso.mode || "-")}</td>
        <td>${escapeHtml(qso.country || "-")}</td>
        <td>${escapeHtml(qso.grid || "-")}</td>
      </tr>
    `;
  }).join("");
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
  url.pathname = url.pathname.replace(/ham-map\.html$/i, "ham-map-embed.html");
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
