import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const QRZ_API_ENDPOINT = process.env.QRZ_API_ENDPOINT || "https://logbook.qrz.com/api";
const QRZ_API_KEY = process.env.QRZ_API_KEY;
const QRZ_FETCH_OPTIONS = (process.env.QRZ_FETCH_OPTIONS || "").trim();

const QRZ_USERNAME = process.env.QRZ_USERNAME;
const QRZ_PASSWORD = process.env.QRZ_PASSWORD;
const QRZ_QSO_ENDPOINT = process.env.QRZ_QSO_ENDPOINT;

const QRZ_AGENT = process.env.QRZ_AGENT || "sp3fck-ham-map/1.0";
const HOME_LOCATOR = process.env.HOME_LOCATOR || "JO72SG";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true
});

async function main() {
  let normalized = [];
  let source = "qrz-logbook-api";

  if (QRZ_API_KEY) {
    normalized = await fetchViaLogbookApi();
  } else if (QRZ_USERNAME && QRZ_PASSWORD && QRZ_QSO_ENDPOINT) {
    source = "qrz-xml-legacy";
    normalized = await fetchViaLegacyXml();
  } else {
    throw new Error(
      "Missing credentials. Use QRZ_API_KEY (recommended) or legacy QRZ_USERNAME/QRZ_PASSWORD/QRZ_QSO_ENDPOINT"
    );
  }

  normalized.sort((a, b) => String(b.datetime).localeCompare(String(a.datetime)));

  const payload = {
    updatedAt: new Date().toISOString(),
    source,
    homeLocator: HOME_LOCATOR,
    qsos: normalized
  };

  const outputPath = path.join(process.cwd(), "data", "qso.latest.json");
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  if (normalized.length === 0) {
    console.warn("No QSO records returned by API for current fetch options. Wrote empty dataset.");
  }
  console.log(`Wrote ${normalized.length} QSO entries to ${outputPath}`);
}

async function fetchViaLogbookApi() {
  const statusResponse = await requestLogbookApi({
    KEY: QRZ_API_KEY,
    ACTION: "STATUS"
  });

  const statusPairs = parseNestedPairs(statusResponse.DATA || "");
  const owner = statusPairs.owner || statusPairs.call || "unknown";
  const bookName = statusPairs.bookname || statusPairs.name || "unknown";
  const total = statusPairs.qsos || statusPairs.total || statusResponse.COUNT || "unknown";
  console.log(`QRZ STATUS: owner=${owner}, book=${bookName}, qsos=${total}`);

  const fetchParams = {
    KEY: QRZ_API_KEY,
    ACTION: "FETCH"
  };
  if (QRZ_FETCH_OPTIONS) {
    fetchParams.OPTION = QRZ_FETCH_OPTIONS;
  }

  let fetchResponse = await requestLogbookApi(fetchParams);
  let adif = pickAny(fetchResponse, ["ADIF", "adif", "AdiF"]);

  // Some OPTION combinations return COUNT without ADIF. Retry plain FETCH once.
  if (!adif && QRZ_FETCH_OPTIONS && Number(fetchResponse.COUNT || 0) > 0) {
    console.warn(`QRZ FETCH with OPTION='${QRZ_FETCH_OPTIONS}' returned no ADIF. Retrying plain FETCH.`);
    fetchResponse = await requestLogbookApi({
      KEY: QRZ_API_KEY,
      ACTION: "FETCH"
    });
    adif = pickAny(fetchResponse, ["ADIF", "adif", "AdiF"]);
  }

  if (!adif) {
    const count = fetchResponse.COUNT || "0";
    console.warn(`QRZ FETCH returned no ADIF payload (COUNT=${count}, OPTION=${QRZ_FETCH_OPTIONS || "<none>"}).`);
    return [];
  }

  return parseAdif(adif)
    .map(normalizeQso)
    .filter(Boolean);
}

async function requestLogbookApi(params) {
  const responseText = await getQuery(`${QRZ_API_ENDPOINT}?${new URLSearchParams(params).toString()}`);
  const response = Object.fromEntries(new URLSearchParams(responseText));

  const result = (response.RESULT || "").toUpperCase();
  if (result !== "OK") {
    throw new Error(
      `QRZ Logbook API error: ACTION=${params.ACTION || ""} RESULT=${response.RESULT || ""} REASON=${response.REASON || ""}`
    );
  }

  return response;
}

function pickAny(obj, keys) {
  for (const key of keys) {
    if (obj[key]) {
      return obj[key];
    }
  }
  return "";
}

async function getQuery(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": QRZ_AGENT,
      "Accept": "text/plain,*/*"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 500)}`);
  }

  return res.text();
}

function parseNestedPairs(text) {
  const out = {};
  for (const pair of String(text).split("&")) {
    const [k, v] = pair.split("=");
    if (!k) {
      continue;
    }
    out[k.trim().toLowerCase()] = decodeURIComponent((v || "").replaceAll("+", "%20")).trim();
  }
  return out;
}

async function fetchViaLegacyXml() {
  const key = await fetchSessionKey();
  const qsoUrl = QRZ_QSO_ENDPOINT.replaceAll("{KEY}", key);
  const qsoXml = await fetchText(qsoUrl);
  const qsoDoc = xmlParser.parse(qsoXml);

  return collectQsoNodes(qsoDoc)
    .map(normalizeQso)
    .filter(Boolean);
}

async function fetchSessionKey() {
  const loginUrl = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(QRZ_USERNAME)};password=${encodeURIComponent(QRZ_PASSWORD)};agent=${encodeURIComponent(QRZ_AGENT)}`;
  const loginXml = await fetchText(loginUrl);
  const loginDoc = xmlParser.parse(loginXml);

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

function parseAdif(adifText) {
  const records = [];
  let current = {};
  const regex = /<([^:>\s]+):([0-9]+)(?::[^>]+)?>/gi;
  let cursor = 0;
  let match;

  while ((match = regex.exec(adifText)) !== null) {
    const tag = match[1].toLowerCase();
    const length = Number(match[2]);
    const valueStart = regex.lastIndex;
    const valueEnd = valueStart + length;
    const rawValue = adifText.slice(valueStart, valueEnd);
    regex.lastIndex = valueEnd;
    cursor = valueEnd;

    if (tag === "eor") {
      if (Object.keys(current).length > 0) {
        records.push(current);
      }
      current = {};
      continue;
    }

    current[tag] = rawValue.trim();
  }

  if (Object.keys(current).length > 0 || cursor > 0) {
    records.push(current);
  }

  return records;
}

async function postForm(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": QRZ_AGENT,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 500)}`);
  }

  return res.text();
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

  const band = normalizeBand(pick(item, ["band", "qrg", "freq"]));
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
