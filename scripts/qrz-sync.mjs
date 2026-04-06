import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const QRZ_USERNAME = process.env.QRZ_USERNAME;
const QRZ_PASSWORD = process.env.QRZ_PASSWORD;
const QRZ_QSO_ENDPOINT = process.env.QRZ_QSO_ENDPOINT;
const QRZ_AGENT = process.env.QRZ_AGENT || "sp3fck-ham-map/1.0";
const HOME_LOCATOR = process.env.HOME_LOCATOR || "JO72SG";

if (!QRZ_USERNAME || !QRZ_PASSWORD || !QRZ_QSO_ENDPOINT) {
  console.error("Missing env vars: QRZ_USERNAME, QRZ_PASSWORD, QRZ_QSO_ENDPOINT");
  process.exit(1);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true
});

const LOGIN_URL = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(QRZ_USERNAME)};password=${encodeURIComponent(QRZ_PASSWORD)};agent=${encodeURIComponent(QRZ_AGENT)}`;

async function main() {
  const key = await fetchSessionKey();
  const qsoUrl = QRZ_QSO_ENDPOINT.replaceAll("{KEY}", key);

  const qsoXml = await fetchText(qsoUrl);
  const qsoDoc = parser.parse(qsoXml);

  const raw = collectQsoNodes(qsoDoc);
  const normalized = raw
    .map(normalizeQso)
    .filter(Boolean)
    .sort((a, b) => String(b.datetime).localeCompare(String(a.datetime)));

  if (normalized.length === 0) {
    throw new Error("No QSO records parsed. Check QRZ_QSO_ENDPOINT and XML format.");
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: "qrz-xml",
    homeLocator: HOME_LOCATOR,
    qsos: normalized
  };

  const outputPath = path.join(process.cwd(), "data", "qso.latest.json");
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${normalized.length} QSO entries to ${outputPath}`);
}

async function fetchSessionKey() {
  const loginXml = await fetchText(LOGIN_URL);
  const loginDoc = parser.parse(loginXml);

  const session = loginDoc?.QRZDatabase?.Session;
  const error = valueAsString(session?.Error);
  if (error) {
    throw new Error(`QRZ session error: ${error}`);
  }

  const key = valueAsString(session?.Key);
  if (!key) {
    throw new Error("No session key returned by QRZ login.");
  }
  return key;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": QRZ_AGENT,
      "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}\n${body.slice(0, 500)}`);
  }

  return res.text();
}

function collectQsoNodes(root) {
  const out = [];

  walk(root, (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return;
    }

    const lowerKeys = Object.keys(node).map((k) => k.toLowerCase());
    const hasCall = lowerKeys.includes("call") || lowerKeys.includes("callsign");
    const hasBand = lowerKeys.includes("band");
    const hasDateLike = lowerKeys.includes("date") || lowerKeys.includes("qso_date") || lowerKeys.includes("datetime") || lowerKeys.includes("time_on");

    if (hasCall && (hasBand || hasDateLike)) {
      out.push(node);
    }
  });

  return out;
}

function walk(node, onNode) {
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, onNode));
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }

  onNode(node);
  for (const value of Object.values(node)) {
    walk(value, onNode);
  }
}

function normalizeQso(item) {
  const callsign = pick(item, ["call", "callsign", "dxcall", "station_callsign"]);
  if (!callsign) {
    return null;
  }

  const bandRaw = pick(item, ["band", "qrg"]);
  const band = normalizeBand(bandRaw);

  const mode = pick(item, ["mode", "submode"]);
  const country = pick(item, ["country", "dxcc_name", "entity"]);
  const grid = pick(item, ["grid", "gridsquare", "locator"]);

  let lat = pickNumber(item, ["lat", "latitude", "rx_lat", "station_lat"]);
  let lon = pickNumber(item, ["lon", "lng", "longitude", "rx_lon", "station_lon"]);

  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && grid) {
    try {
      const fromGrid = maidenheadToLatLon(grid);
      lat = fromGrid.lat;
      lon = fromGrid.lon;
    } catch {
      lat = undefined;
      lon = undefined;
    }
  }

  const datetime = normalizeDateTime(item);

  return {
    id: `${datetime || "unknown"}-${callsign}-${band || "na"}-${mode || "na"}`,
    datetime,
    callsign,
    band,
    mode,
    country,
    grid,
    lat,
    lon
  };
}

function normalizeDateTime(item) {
  const iso = pick(item, ["datetime", "time", "timestamp"]);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.valueOf())) {
      return d.toISOString();
    }
  }

  const qsoDate = pick(item, ["qso_date", "date", "qsodate"]);
  const qsoTime = pick(item, ["time_on", "time", "qso_time", "utc"]);
  if (qsoDate) {
    const compactDate = qsoDate.replaceAll("-", "");
    const compactTime = (qsoTime || "000000").replaceAll(":", "").padEnd(6, "0").slice(0, 6);
    const stamp = `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}T${compactTime.slice(0, 2)}:${compactTime.slice(2, 4)}:${compactTime.slice(4, 6)}Z`;
    const d = new Date(stamp);
    if (!Number.isNaN(d.valueOf())) {
      return d.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeBand(input) {
  const raw = valueAsString(input);
  if (!raw) {
    return "";
  }

  const cleaned = raw.toLowerCase().replace("meter", "m").replace("meters", "m").trim();
  if (/^\d+(\.\d+)?m$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    return `${cleaned}m`;
  }

  return cleaned;
}

function pick(item, keys) {
  const map = lowerKeyMap(item);
  for (const key of keys) {
    if (key in map) {
      const val = valueAsString(map[key]);
      if (val) {
        return val;
      }
    }
  }
  return "";
}

function pickNumber(item, keys) {
  const text = pick(item, keys);
  if (!text) {
    return undefined;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function lowerKeyMap(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
}

function valueAsString(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(value).trim();
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
