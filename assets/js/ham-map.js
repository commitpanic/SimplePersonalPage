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
const statUpdatedEl = document.getElementById("statUpdated");

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

applyBtn?.addEventListener("click", applyFilters);
clearBtn?.addEventListener("click", () => {
  fromEl.value = "";
  toEl.value = "";
  bandEl.value = "all";
  applyFilters();
});
refreshBtn?.addEventListener("click", async () => {
  await loadQsoData();
  applyFilters();
});

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

  const filtered = allQsos.filter((qso) => {
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

  renderMap(filtered);
  renderStats(filtered);
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
