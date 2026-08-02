const POTA_API_URL = "https://api.pota.app/spot/activator";
const LLOTA_API_URL = "https://llota.app/api/public/spots";
const LLOTA_PROXY_URL = "/api/llota-spots";
const BOTA_API_URL = "https://api.wwbota.org/spots/";
const STORAGE_DONE_KEY = "sp3fck-spots-qso-done";
const REFRESH_MS = 30_000;
const GROUP_KEYS = ["source", "band", "country", "mode"];

const state = {
  rows: [],
  doneMap: loadDoneMap(),
  timer: null,
  countrySearch: "",
  draftFilters: null,
  filterOptions: {
    source: [],
    band: [],
    country: [],
    mode: [],
  },
  dynamicOptions: {
    source: [],
    band: [],
    country: [],
    mode: [],
  },
  filters: {
    source: new Set(),
    band: new Set(),
    country: new Set(),
    mode: new Set(),
    countryExclude: false,
  },
};

const regionNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

function isLocalDevHost() {
  const host = String(globalThis.location?.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

const els = {
  time: document.getElementById("time-filter"),
  search: document.getElementById("search-filter"),
  meta: document.getElementById("spots-meta"),
  refresh: document.getElementById("refresh-btn"),
  pauseRefresh: document.getElementById("pause-refresh-toggle"),
  tbody: document.getElementById("spots-body"),
  activeFilters: document.getElementById("active-filters"),

  modal: document.getElementById("filters-modal"),
  modalBackdrop: document.getElementById("filters-backdrop"),
  openFiltersBtn: document.getElementById("open-filters-btn"),
  closeFiltersBtn: document.getElementById("close-filters-btn"),
  applyFiltersBtn: document.getElementById("apply-filters-btn"),
  clearFiltersBtn: document.getElementById("clear-filters-btn"),
  selectAllFiltersBtn: document.getElementById("select-all-filters-btn"),

  sourceOptions: document.getElementById("source-options"),
  bandOptions: document.getElementById("band-options"),
  countryOptions: document.getElementById("country-options"),
  modeOptions: document.getElementById("mode-options"),
  countrySearch: document.getElementById("country-search"),
  countryExclude: document.getElementById("country-exclude-toggle"),
};

function loadDoneMap() {
  try {
    const raw = localStorage.getItem(STORAGE_DONE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDoneMap() {
  localStorage.setItem(STORAGE_DONE_KEY, JSON.stringify(state.doneMap));
}

function optionValue(el) {
  return el ? el.value : "all";
}

function parseUtcDate(isoLike) {
  if (!isoLike) return null;
  const normalized = isoLike.endsWith("Z") ? isoLike : `${isoLike}Z`;
  const dt = new Date(normalized);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function minutesAgo(dt) {
  if (!dt) return Number.POSITIVE_INFINITY;
  const diffMs = Date.now() - dt.getTime();
  return diffMs / 60_000;
}

function getCountryCode(row) {
  const loc = String(row.locationDesc || "").trim();
  if (!loc) return "--";
  const firstChunk = loc.split(",")[0].trim();
  const firstPart = firstChunk.split("-")[0].trim();
  return firstPart || "--";
}

function getBandFromFrequency(freqValue) {
  const freq = Number.parseFloat(String(freqValue || "").replace(",", "."));
  if (!Number.isFinite(freq)) return "?";

  if (freq >= 1800 && freq < 2000) return "160m";
  if (freq >= 3500 && freq < 4000) return "80m";
  if (freq >= 5330 && freq <= 5406) return "60m";
  if (freq >= 7000 && freq < 7300) return "40m";
  if (freq >= 10100 && freq < 10150) return "30m";
  if (freq >= 14000 && freq < 14350) return "20m";
  if (freq >= 18068 && freq < 18168) return "17m";
  if (freq >= 21000 && freq < 21450) return "15m";
  if (freq >= 24890 && freq < 24990) return "12m";
  if (freq >= 28000 && freq < 29700) return "10m";
  if (freq >= 50000 && freq < 54000) return "6m";
  if (freq >= 144000 && freq < 148000) return "2m";
  if (freq >= 420000 && freq < 450000) return "70cm";
  return "other";
}

function rowKey(row) {
  if (row.sourcePortal === "LLOTA" && row.spotId != null) return `llota-${row.spotId}`;
  if (row.sourcePortal === "BOTA" && row.spotId != null) return `bota-${row.spotId}`;
  if (row.spotId != null) return `spot-${row.spotId}`;
  return `${row.activator || "?"}-${row.reference || "?"}-${row.spotTime || "?"}`;
}

function normalizeFrequencyToKhz(freqValue) {
  const num = Number.parseFloat(String(freqValue || "").replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return num < 1000 ? num * 1000 : num;
}

function formatFrequencyKhz(freqKhz) {
  if (!Number.isFinite(freqKhz)) return "";
  return freqKhz.toFixed(1).replace(/\.0$/, "");
}

function getCountryCodeFromLlotaReference(reference) {
  const ref = String(reference || "").trim().toUpperCase();
  const match = /^LL([A-Z]{2})-/.exec(ref);
  return match ? match[1] : "--";
}

function getCountryCodeFromBotaReference(reference) {
  const ref = String(reference || "").trim().toUpperCase();
  const match = /^B\/([A-Z0-9]{1,4})-/.exec(ref);
  if (!match) return "--";
  const token = match[1];
  const prefixToIso = {
    A: "AT",
    CT: "PT",
    DL: "DE",
    EI: "IE",
    EA: "ES",
    ES: "ES",
    F: "FR",
    G: "GB",
    GW: "GB",
    GD: "GB",
    GI: "GB",
    GM: "GB",
    GU: "GB",
    G: "GB",
    HB: "CH",
    HA: "HU",
    HG: "HU",
    I: "IT",
    JA: "JP",
    K: "US",
    LA: "NO",
    LX: "LU",
    OE: "AT",
    OH: "FI",
    ON: "BE",
    OZ: "DK",
    PA: "NL",
    SV: "GR",
    S5: "SI",
    SV: "Greece",
    S5: "SI",
    T9: "BA",
    UA: "UA",
    VE: "CA",
    VK: "AU",
    W: "US",
    YU: "RS",
    YL: "LV",
    YO: "RO",
    ZL: "NZ",
  };
  if (token in prefixToIso) return prefixToIso[token];

  const twoLetter = token.slice(0, 2);
  if (twoLetter in prefixToIso) return prefixToIso[twoLetter];

  const oneLetter = token.slice(0, 1);
  if (oneLetter in prefixToIso) return prefixToIso[oneLetter];

  return "--";
}

function mapPotaRow(row) {
  const utcDate = parseUtcDate(String(row.spotTime || ""));
  const freqKhz = normalizeFrequencyToKhz(row.frequency);

  return {
    raw: row,
    sourcePortal: "POTA",
    spotId: row.spotId,
    id: "",
    spotSource: String(row.source || ""),
    timeUtc: utcDate,
    timeUtcLabel: utcDate
      ? utcDate.toISOString().slice(0, 16).replace("T", " ")
      : "-",
    activator: String(row.activator || ""),
    reference: String(row.reference || ""),
    park: String(row.name || row.parkName || ""),
    country: getCountryCode(row),
    band: getBandFromFrequency(freqKhz),
    freq: formatFrequencyKhz(freqKhz),
    mode: String(row.mode || ""),
    spotter: String(row.spotter || ""),
    comment: String(row.comments || ""),
  };
}

function mapLlotaRow(row) {
  const utcDate = parseUtcDate(String(row.updated_at || row.created_at || ""));
  const freqKhz = normalizeFrequencyToKhz(row.frequency);
  const history = Array.isArray(row.history) ? row.history : [];
  const lastHistory = history.length ? history[history.length - 1] : null;

  const commentFromHistory = [...history]
    .reverse()
    .map((h) => (h && h.comment ? String(h.comment) : ""))
    .find((v) => Boolean(v));

  const spotter = lastHistory
    ? String(lastHistory.spotter_callsign || lastHistory.spotter_display_name || "")
    : "";

  return {
    raw: row,
    sourcePortal: "LLOTA",
    spotId: row.id,
    id: "",
    spotSource: String(row.spotted_by_app || ""),
    timeUtc: utcDate,
    timeUtcLabel: utcDate
      ? utcDate.toISOString().slice(0, 16).replace("T", " ")
      : "-",
    activator: String(row.callsign || ""),
    reference: String(row.reference || ""),
    park: String(row.reference_name || ""),
    country: getCountryCodeFromLlotaReference(row.reference),
    band: getBandFromFrequency(freqKhz),
    freq: formatFrequencyKhz(freqKhz),
    mode: String(row.mode || ""),
    spotter,
    comment: commentFromHistory || "",
  };
}

function mapBotaRow(row) {
  const utcDate = parseUtcDate(String(row.time || ""));
  const freqKhz = normalizeFrequencyToKhz(row.freq);
  const refs = Array.isArray(row.references) ? row.references : [];
  const firstRef = refs[0] || null;

  const reference = firstRef ? String(firstRef.reference || "") : "";
  const parkName = firstRef ? String(firstRef.name || "") : "";
  const countryCode = getCountryCodeFromBotaReference(reference);
  const sourceType = String(row.type || "").trim();

  return {
    raw: row,
    sourcePortal: "BOTA",
    spotId: String(row.time || "") + "-" + String(row.call || ""),
    id: "",
    spotSource: sourceType || "Web",
    timeUtc: utcDate,
    timeUtcLabel: utcDate
      ? utcDate.toISOString().slice(0, 16).replace("T", " ")
      : "-",
    activator: String(row.call || ""),
    reference,
    park: parkName,
    country: countryCode,
    band: getBandFromFrequency(freqKhz),
    freq: formatFrequencyKhz(freqKhz),
    mode: String(row.mode || ""),
    spotter: String(row.spotter || ""),
    comment: String(row.comment || ""),
  };
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSelection(groupKey) {
  const options = state.dynamicOptions[groupKey];
  const selected = state.filters[groupKey];
  const filtered = new Set(options.filter((v) => selected.has(v)));

  state.filters[groupKey] = filtered;
}

function countryLabel(code) {
  const normalized = String(code || "").trim();
  if (!normalized || normalized === "--") return normalized || "--";
  if (!regionNames || normalized.length !== 2) return normalized;
  const name = regionNames.of(normalized.toUpperCase());
  return name ? `${normalized} (${name})` : normalized;
}

function cloneFilters(src) {
  return {
    source: new Set(src.source),
    band: new Set(src.band),
    country: new Set(src.country),
    mode: new Set(src.mode),
    countryExclude: Boolean(src.countryExclude),
  };
}

function getEditableFilters() {
  return state.draftFilters || state.filters;
}

function optionListFromRows(rows, groupKey) {
  if (groupKey === "source") {
    return [...new Set(rows.map((r) => r.sourcePortal).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }
  if (groupKey === "band") {
    return [...new Set(rows.map((r) => r.band).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }
  if (groupKey === "country") {
    return [...new Set(rows.map((r) => r.country).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }
  return [...new Set(rows.map((r) => r.mode).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function matchSet(value, selectedSet) {
  return selectedSet.size === 0 || selectedSet.has(value);
}

function rowMatchesSearchAndTime(row) {
  const timeFilter = optionValue(els.time);
  const searchFilter = (els.search?.value || "").trim().toLowerCase();

  if (String(row.comment || "").toLowerCase().includes("qrt")) {
    return false;
  }

  if (timeFilter !== "all") {
    const maxMinutes = Number.parseFloat(timeFilter);
    if (Number.isFinite(maxMinutes) && minutesAgo(row.timeUtc) > maxMinutes) return false;
  }

  if (searchFilter) {
    const haystack = [
      row.activator,
      row.reference,
      row.park,
      row.country,
      row.mode,
      row.comment,
      row.spotter,
    ].join(" ").toLowerCase();
    if (!haystack.includes(searchFilter)) return false;
  }

  return true;
}

function rowMatchesFacetFilters(row, filters, skipGroup = null) {
  if (skipGroup !== "source" && !matchSet(row.sourcePortal, filters.source)) return false;
  if (skipGroup !== "band" && !matchSet(row.band, filters.band)) return false;
  if (skipGroup !== "mode" && !matchSet(row.mode, filters.mode)) return false;

  if (skipGroup !== "country") {
    const countrySelected = filters.country;
    const isSelected = countrySelected.has(row.country);

    if (!filters.countryExclude && countrySelected.size > 0 && !isSelected) return false;
    if (filters.countryExclude && countrySelected.size > 0 && isSelected) return false;
  }

  return true;
}

function recomputeDynamicOptions() {
  const editable = getEditableFilters();

  const pass1 = {};
  GROUP_KEYS.forEach((groupKey) => {
    const rows = state.rows.filter((row) => rowMatchesSearchAndTime(row) && rowMatchesFacetFilters(row, editable, groupKey));
    pass1[groupKey] = optionListFromRows(rows, groupKey);
  });

  GROUP_KEYS.forEach((groupKey) => {
    const next = new Set([...editable[groupKey]].filter((v) => pass1[groupKey].includes(v)));
    editable[groupKey] = next;
  });

  const pass2 = {};
  GROUP_KEYS.forEach((groupKey) => {
    const rows = state.rows.filter((row) => rowMatchesSearchAndTime(row) && rowMatchesFacetFilters(row, editable, groupKey));
    pass2[groupKey] = optionListFromRows(rows, groupKey);
  });

  state.dynamicOptions = pass2;
}

function renderCheckItems(containerEl, groupKey, options, searchTerm = "") {
  if (!containerEl) return;

  const lowerSearch = searchTerm.trim().toLowerCase();
  const selected = getEditableFilters()[groupKey];
  const visible = lowerSearch
    ? options.filter((v) => v.toLowerCase().includes(lowerSearch))
    : options;

  containerEl.innerHTML = visible.map((value) => {
    const checked = selected.has(value) ? "checked" : "";
    const label = groupKey === "country" ? countryLabel(value) : value;
    return `
      <label class="check-item">
        <input type="checkbox" data-group="${groupKey}" value="${escapeHtml(value)}" ${checked}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }).join("");

  if (!visible.length) {
    containerEl.innerHTML = '<p class="status">No options found.</p>';
  }
}

function renderFilterOptions() {
  const editable = getEditableFilters();

  renderCheckItems(els.sourceOptions, "source", state.dynamicOptions.source);
  renderCheckItems(els.bandOptions, "band", state.dynamicOptions.band);
  renderCheckItems(
    els.countryOptions,
    "country",
    state.dynamicOptions.country,
    state.countrySearch,
  );
  renderCheckItems(els.modeOptions, "mode", state.dynamicOptions.mode);

  if (els.countryExclude) {
    els.countryExclude.checked = editable.countryExclude;
  }
}

function isGroupAllSelected(groupKey) {
  const options = state.dynamicOptions[groupKey];
  const selected = state.filters[groupKey];
  return options.length === 0 || selected.size === 0 || selected.size === options.length;
}

function groupSummary(groupKey, label) {
  const options = state.dynamicOptions[groupKey];
  const selected = [...state.filters[groupKey]];

  if (options.length === 0 || isGroupAllSelected(groupKey)) {
    return `${label}: all`;
  }

  if (selected.length <= 3) {
    return `${label}: ${selected.join(", ")}`;
  }

  return `${label}: ${selected.length} selected`;
}

function renderActiveFilterChips() {
  if (!els.activeFilters) return;

  const chips = [
    groupSummary("source", "Source"),
    groupSummary("band", "Band"),
    groupSummary("country", state.filters.countryExclude ? "Country not" : "Country"),
    groupSummary("mode", "Mode"),
  ];

  els.activeFilters.innerHTML = chips
    .map((text) => `<span class="filter-chip">${escapeHtml(text)}</span>`)
    .join("");
}

function matchesSet(value, selectedSet, allOptions) {
  return selectedSet.size === 0 || selectedSet.size === allOptions.length || selectedSet.has(value);
}

function applyFilters() {
  recomputeDynamicOptions();
  normalizeSelection("source");
  normalizeSelection("band");
  normalizeSelection("country");
  normalizeSelection("mode");

  let rows = state.rows.filter((r) => {
    if (!matchesSet(r.sourcePortal, state.filters.source, state.dynamicOptions.source)) return false;
    if (!matchesSet(r.band, state.filters.band, state.dynamicOptions.band)) return false;
    if (!matchesSet(r.mode, state.filters.mode, state.dynamicOptions.mode)) return false;

    const countryIsSelected = state.filters.country.has(r.country);
    const countryRestricts = !(state.filters.country.size === 0 || state.filters.country.size === state.dynamicOptions.country.length);
    if (countryRestricts) {
      if (!state.filters.countryExclude && !countryIsSelected) return false;
      if (state.filters.countryExclude && countryIsSelected) return false;
    }

    if (!rowMatchesSearchAndTime(r)) return false;

    return true;
  });

  rows = rows.sort((a, b) => {
    const aDone = state.doneMap[a.id] ? 1 : 0;
    const bDone = state.doneMap[b.id] ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    const at = a.timeUtc ? a.timeUtc.getTime() : 0;
    const bt = b.timeUtc ? b.timeUtc.getTime() : 0;
    return bt - at;
  });

  renderRows(rows);
  renderActiveFilterChips();

  if (state.draftFilters) {
    renderFilterOptions();
  }
}

function renderRows(rows) {
  if (!els.tbody) return;

  if (!rows.length) {
    els.tbody.innerHTML = `
      <tr>
        <td colspan="12">No spots match current filters.</td>
      </tr>
    `;
    return;
  }

  els.tbody.innerHTML = rows.map((r) => {
    const done = Boolean(state.doneMap[r.id]);
    const sourceClass = r.sourcePortal === "LLOTA"
      ? "source-llota"
      : (r.sourcePortal === "BOTA" ? "source-bota" : "source-pota");
    const sourceIcon = r.sourcePortal === "LLOTA"
      ? "fa-solid fa-water"
      : (r.sourcePortal === "BOTA" ? "fa-solid fa-bunker" : "fa-solid fa-tree");
    const sourceSub = r.spotSource ? escapeHtml(r.spotSource) : "-";
    return `
      <tr class="${done ? "done-row" : ""}">
        <td>
          <input
            class="qso-done"
            type="checkbox"
            data-row-id="${escapeHtml(r.id)}"
            ${done ? "checked" : ""}
            aria-label="Mark QSO done for ${escapeHtml(r.activator)} ${escapeHtml(r.reference)}"
          >
        </td>
        <td class="mono">${escapeHtml(r.timeUtcLabel)}</td>
        <td class="mono">${escapeHtml(r.activator)}</td>
        <td class="mono">${escapeHtml(r.reference)}</td>
        <td>${escapeHtml(r.park)}</td>
        <td class="mono">${escapeHtml(r.country)}</td>
        <td><span class="pill">${escapeHtml(r.band)}</span></td>
        <td class="mono">${escapeHtml(r.freq)}</td>
        <td class="mono">${escapeHtml(r.mode)}</td>
        <td class="mono">${escapeHtml(r.spotter)}</td>
        <td>
          <div class="source-cell">
            <span class="source-pill ${sourceClass}"><i class="${sourceIcon}"></i>${escapeHtml(r.sourcePortal)}</span>
            <span class="source-sub mono">${sourceSub}</span>
          </div>
        </td>
        <td>${escapeHtml(r.comment)}</td>
      </tr>
    `;
  }).join("");
}

function setMeta(text, isError = false) {
  if (!els.meta) return;
  els.meta.classList.toggle("error-box", isError);
  els.meta.textContent = text;
}

function isRefreshPaused() {
  return Boolean(els.pauseRefresh?.checked);
}

async function fetchArrayJson(url, label) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${label} HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`${label} unexpected API format`);
  }
  return data;
}

async function fetchArrayJsonFromAny(urls, label) {
  const errors = [];

  for (const url of urls) {
    try {
      return await fetchArrayJson(url, label);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${url} -> ${msg}`);
    }
  }

  throw new Error(errors.join(" | "));
}

async function fetchSpots() {
  const llotaUrls = isLocalDevHost()
    ? [LLOTA_PROXY_URL, LLOTA_API_URL]
    : [LLOTA_API_URL];

  const sources = [
    { key: "POTA", urls: [POTA_API_URL], mapper: mapPotaRow },
    { key: "LLOTA", urls: llotaUrls, mapper: mapLlotaRow },
    { key: "BOTA", urls: [BOTA_API_URL], mapper: mapBotaRow },
  ];

  const settled = await Promise.allSettled(
    sources.map((s) => fetchArrayJsonFromAny(s.urls, s.key)),
  );

  const rows = [];
  const failures = [];

  settled.forEach((result, idx) => {
    const src = sources[idx];
    if (result.status === "fulfilled") {
      rows.push(...result.value.map(src.mapper));
      return;
    }

    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    failures.push(`${src.key}: ${reason}`);
  });

  if (!rows.length) {
    throw new Error(failures.join(" | ") || "No source available");
  }

  const normalizedRows = rows.map((row) => ({
    ...row,
    id: rowKey(row),
  }));

  return {
    rows: normalizedRows,
    failures,
  };
}

function refreshFilterOptions() {
  state.filterOptions.source = optionListFromRows(state.rows, "source");
  state.filterOptions.band = optionListFromRows(state.rows, "band");
  state.filterOptions.country = optionListFromRows(state.rows, "country");
  state.filterOptions.mode = optionListFromRows(state.rows, "mode");

  GROUP_KEYS.forEach((groupKey) => {
    if (state.filters[groupKey].size === 0) {
      state.filters[groupKey] = new Set(state.filterOptions[groupKey]);
    }
  });

  recomputeDynamicOptions();
  renderFilterOptions();
}

async function loadAndRender() {
  setMeta("Loading spots...");
  try {
    const { rows, failures } = await fetchSpots();
    state.rows = rows;
    refreshFilterOptions();
    applyFilters();

    const now = new Date().toISOString().slice(11, 19);
    const partialInfo = failures.length ? ` Partial issue: ${failures.join(" | ")}` : "";
    setMeta(`Loaded ${state.rows.length} spots. Last update: ${now} UTC.${partialInfo}`);
  } catch (err) {
    setMeta(
      `Could not load spots (${err instanceof Error ? err.message : "unknown error"}).`,
      true,
    );
    if (els.tbody) {
      els.tbody.innerHTML = "<tr><td colspan=\"12\">No data.</td></tr>";
    }
  }
}

function onQsoToggle(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches(".qso-done")) return;

  const rowId = target.dataset.rowId;
  if (!rowId) return;

  state.doneMap[rowId] = target.checked;
  saveDoneMap();
  applyFilters();
}

function openFiltersModal() {
  if (!els.modal) return;
  state.draftFilters = cloneFilters(state.filters);
  state.countrySearch = "";
  if (els.countrySearch) {
    els.countrySearch.value = "";
  }
  recomputeDynamicOptions();
  renderFilterOptions();
  els.modal.hidden = false;
  els.modal.setAttribute("aria-hidden", "false");
  els.modal.style.display = "grid";
}

function closeFiltersModal() {
  if (!els.modal) return;
  state.draftFilters = null;
  els.modal.hidden = true;
  els.modal.setAttribute("aria-hidden", "true");
  els.modal.style.display = "none";
}

function applyModalFilters() {
  if (state.draftFilters) {
    state.filters = cloneFilters(state.draftFilters);
    state.draftFilters = null;
  }

  applyFilters();
  closeFiltersModal();
}

function updateGroupSelection(groupKey, value, checked) {
  const set = getEditableFilters()[groupKey];
  if (checked) {
    set.add(value);
  } else {
    set.delete(value);
  }
}

function setAllGroups(checked) {
  const editable = getEditableFilters();
  GROUP_KEYS.forEach((groupKey) => {
    editable[groupKey] = checked
      ? new Set(state.dynamicOptions[groupKey])
      : new Set();
  });
  recomputeDynamicOptions();
  renderFilterOptions();

  if (!state.draftFilters) {
    applyFilters();
  }
}

function initEvents() {
  els.time?.addEventListener("change", applyFilters);
  els.search?.addEventListener("input", applyFilters);
  els.refresh?.addEventListener("click", loadAndRender);
  els.tbody?.addEventListener("change", onQsoToggle);

  els.openFiltersBtn?.addEventListener("click", openFiltersModal);
  els.closeFiltersBtn?.addEventListener("click", closeFiltersModal);
  els.modalBackdrop?.addEventListener("click", closeFiltersModal);
  els.applyFiltersBtn?.addEventListener("click", applyModalFilters);

  els.selectAllFiltersBtn?.addEventListener("click", () => setAllGroups(true));
  els.clearFiltersBtn?.addEventListener("click", () => setAllGroups(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.modal && !els.modal.hidden) {
      closeFiltersModal();
    }
  });

  [els.sourceOptions, els.bandOptions, els.countryOptions, els.modeOptions].forEach((containerEl) => {
    containerEl?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
      const group = target.dataset.group;
      if (group !== "source" && group !== "band" && group !== "country" && group !== "mode") return;
      updateGroupSelection(group, target.value, target.checked);
      recomputeDynamicOptions();
      renderFilterOptions();

      if (!state.draftFilters) {
        applyFilters();
      }
    });
  });

  els.countrySearch?.addEventListener("input", () => {
    state.countrySearch = els.countrySearch?.value || "";
    renderCheckItems(
      els.countryOptions,
      "country",
      state.dynamicOptions.country,
      state.countrySearch,
    );
  });

  els.pauseRefresh?.addEventListener("change", () => {
    if (!isRefreshPaused()) {
      loadAndRender();
    }
  });

  els.countryExclude?.addEventListener("change", () => {
    getEditableFilters().countryExclude = Boolean(els.countryExclude?.checked);
    recomputeDynamicOptions();
    renderFilterOptions();

    if (!state.draftFilters) {
      applyFilters();
    }
  });
}

function startAutoRefresh() {
  if (state.timer) {
    window.clearInterval(state.timer);
  }
  state.timer = window.setInterval(() => {
    if (isRefreshPaused()) return;
    loadAndRender();
  }, REFRESH_MS);
}

initEvents();
loadAndRender();
startAutoRefresh();
