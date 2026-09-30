// ── Palety kolorów ────────────────────────────────────────────
const ROLES = [
  { key: 'background', label: 'Tło', hint: 'Tło całej strony' },
  { key: 'surface', label: 'Powierzchnia', hint: 'Karty, sekcje, stopka' },
  { key: 'text', label: 'Tekst', hint: 'Treść i nagłówki' },
  { key: 'primary', label: 'Główny', hint: 'Przyciski, linki, marka' },
  { key: 'accent', label: 'Akcent', hint: 'Wyróżnienia, badge, ikony' },
];

const EMPTY_COLORS = {
  background: '#FFFFFF',
  surface: '#EEEEEE',
  text: '#222222',
  primary: '#888888',
  accent: '#BBBBBB',
};

const STORAGE_KEY = 'kb-custom-palette';

// ── Color helpers ─────────────────────────────────────────────
function normalizeHex(value) {
  let v = String(value).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : null;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function readableOn(hex) {
  return contrast(hex, '#FFFFFF') >= contrast(hex, '#111111') ? '#FFFFFF' : '#111111';
}

function rating(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA duży';
  return 'słaby';
}

// ── Export formats ────────────────────────────────────────────
function toJson(palette) {
  return JSON.stringify(palette, null, 2);
}

function toCss(colors) {
  const lines = ROLES.map(r => `  --color-${r.key}: ${colors[r.key]};`);
  lines.push(`  --color-on-primary: ${readableOn(colors.primary)};`);
  lines.push(`  --color-on-accent: ${readableOn(colors.accent)};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

// ── UI helpers ────────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(msg);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function swatchesHtml(colors) {
  return `<div class="swatches">${ROLES.map(r => {
    const hex = colors[r.key];
    return `<button type="button" class="swatch-btn" data-hex="${hex}" title="Kopiuj ${hex}"
      style="background:${hex};color:${readableOn(hex)}">
      <span class="swatch-role">${r.label}</span>
      <span class="swatch-hex">${hex}</span>
    </button>`;
  }).join('')}</div>`;
}

function miniSiteHtml(c, title = 'Twoja nowa strona') {
  const onPrimary = readableOn(c.primary);
  const onAccent = readableOn(c.accent);
  return `<div class="mini-site" style="background:${c.background};color:${c.text}">
    <div class="mini-nav" style="background:${c.surface}">
      <span class="mini-logo"><i class="fa-solid fa-circle" style="color:${c.primary}"></i>Logo</span>
      <span class="mini-links"><span>O nas</span><span>Oferta</span><span style="color:${c.primary};font-weight:600">Kontakt</span></span>
    </div>
    <div class="mini-hero">
      <span class="mini-badge" style="background:${c.accent};color:${onAccent}">Nowość</span>
      <h4>${escapeHtml(title)}</h4>
      <p>Krótki opis firmy, który zachęca do kontaktu.</p>
      <div class="mini-btns">
        <span class="mini-btn" style="background:${c.primary};color:${onPrimary}">Umów się</span>
        <span class="mini-btn" style="border-color:${c.primary};color:${c.primary}">Więcej</span>
      </div>
    </div>
    <div class="mini-cards">
      <div class="mini-card" style="background:${c.surface}"><i class="fa-solid fa-star" style="color:${c.accent}"></i>Jakość</div>
      <div class="mini-card" style="background:${c.surface}"><i class="fa-solid fa-bolt" style="color:${c.primary}"></i>Szybko</div>
      <div class="mini-card" style="background:${c.surface}"><i class="fa-solid fa-heart" style="color:${c.accent}"></i>Z pasją</div>
    </div>
  </div>`;
}

function contrastHtml(c) {
  const ratio = contrast(c.text, c.background);
  return `<span class="contrast">Kontrast tekstu: <b>${ratio.toFixed(1)}:1</b> (${rating(ratio)})</span>`;
}

// Delegated copy-on-click for every swatch on the page
document.addEventListener('click', e => {
  const sw = e.target.closest('.swatch-btn');
  if (sw) copy(sw.dataset.hex, `Skopiowano ${sw.dataset.hex}`);
});

// ── Preset palettes ───────────────────────────────────────────
const grid = document.getElementById('palette-grid');
const errorEl = document.getElementById('palette-error');

function renderPalettes(palettes) {
  palettes.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'palette-card';
    card.id = p.id;
    card.innerHTML = `
      <div class="palette-top">
        <h3>${escapeHtml(p.name)}</h3>
        <span class="palette-num">#${String(i + 1).padStart(2, '0')} · ${p.mode === 'dark' ? 'ciemna' : 'jasna'}</span>
      </div>
      <p class="palette-mood">${escapeHtml(p.mood)}</p>
      <div class="palette-tags">${p.industries.map(t => `<span class="palette-tag">${escapeHtml(t)}</span>`).join('')}</div>
      ${swatchesHtml(p.colors)}
      ${miniSiteHtml(p.colors, p.name)}
      <div class="palette-foot">
        ${contrastHtml(p.colors)}
        <div class="palette-actions">
          <a class="icon-btn icon-btn-main" href="podglad.html?p=${encodeURIComponent(p.id)}" title="Podgląd strony (desktop i telefon)"><i class="fa-solid fa-eye"></i></a>
          <button type="button" class="icon-btn" data-act="css" title="Kopiuj zmienne CSS"><i class="fa-solid fa-code"></i></button>
          <button type="button" class="icon-btn" data-act="json" title="Kopiuj JSON"><i class="fa-solid fa-copy"></i></button>
          <button type="button" class="icon-btn" data-act="edit" title="Edytuj we własnym zestawie"><i class="fa-solid fa-pen"></i></button>
        </div>
      </div>`;
    card.querySelector('[data-act="css"]').addEventListener('click', () => copy(toCss(p.colors), 'Skopiowano CSS'));
    card.querySelector('[data-act="json"]').addEventListener('click', () => copy(toJson(p), 'Skopiowano JSON'));
    card.querySelector('[data-act="edit"]').addEventListener('click', () => {
      setCustom({ name: `${p.name} (wariant)`, colors: { ...p.colors } });
      document.getElementById('custom').scrollIntoView({ behavior: 'smooth' });
    });
    grid.appendChild(card);
  });
}

fetch('palettes.json', { cache: 'no-cache' })
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(data => renderPalettes(data.palettes))
  .catch(err => {
    errorEl.hidden = false;
    errorEl.textContent = `Nie udało się wczytać palettes.json (${err.message}). Otwórz stronę przez serwer HTTP, nie z pliku.`;
  });

// ── Custom palette ────────────────────────────────────────────
const nameInput = document.getElementById('custom-name');
const pickersEl = document.getElementById('custom-pickers');
const previewEl = document.getElementById('custom-preview');
const DEFAULT_NAME = nameInput.value;

let custom = { name: DEFAULT_NAME, colors: { ...EMPTY_COLORS } };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && saved.colors) {
    custom.name = saved.name || DEFAULT_NAME;
    ROLES.forEach(r => {
      custom.colors[r.key] = normalizeHex(saved.colors[r.key]) || EMPTY_COLORS[r.key];
    });
  }
} catch { /* storage unavailable */ }

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom';
}

function customPalette() {
  return {
    id: slugify(custom.name),
    name: custom.name,
    mode: luminance(custom.colors.background) < 0.2 ? 'dark' : 'light',
    mood: '',
    industries: [],
    colors: { ...custom.colors },
  };
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); } catch { /* ignore */ }
}

const previewLink = document.getElementById('custom-preview-link');

function renderPreview() {
  previewEl.innerHTML = miniSiteHtml(custom.colors, custom.name) + swatchesHtml(custom.colors) + contrastHtml(custom.colors);
  previewLink.href = `podglad.html?c=${ROLES.map(r => custom.colors[r.key].slice(1)).join(',')}`;
}

const pickerInputs = {};

ROLES.forEach(r => {
  const row = document.createElement('div');
  row.className = 'picker-row';
  row.innerHTML = `
    <input type="color" aria-label="${r.label}">
    <div class="picker-meta">
      <span class="picker-label">${r.label}</span>
      <span class="picker-hint">${r.hint}</span>
      <input type="text" class="hex-input" maxlength="7" spellcheck="false" aria-label="${r.label} HEX">
    </div>`;
  const color = row.querySelector('input[type="color"]');
  const hex = row.querySelector('.hex-input');

  color.addEventListener('input', () => {
    const v = color.value.toUpperCase();
    hex.value = v;
    hex.classList.remove('invalid');
    custom.colors[r.key] = v;
    renderPreview();
    save();
  });

  hex.addEventListener('input', () => {
    const v = normalizeHex(hex.value);
    hex.classList.toggle('invalid', !v);
    if (!v) return;
    color.value = v.toLowerCase();
    custom.colors[r.key] = v;
    renderPreview();
    save();
  });

  hex.addEventListener('blur', () => {
    hex.value = custom.colors[r.key];
    hex.classList.remove('invalid');
  });

  pickerInputs[r.key] = { color, hex };
  pickersEl.appendChild(row);
});

function setCustom(next) {
  custom = next;
  nameInput.value = custom.name;
  ROLES.forEach(r => {
    const v = custom.colors[r.key];
    pickerInputs[r.key].color.value = v.toLowerCase();
    pickerInputs[r.key].hex.value = v;
    pickerInputs[r.key].hex.classList.remove('invalid');
  });
  renderPreview();
  save();
}

nameInput.addEventListener('input', () => {
  custom.name = nameInput.value.trim() || DEFAULT_NAME;
  renderPreview();
  save();
});

document.getElementById('custom-reset').addEventListener('click', () => {
  setCustom({ name: DEFAULT_NAME, colors: { ...EMPTY_COLORS } });
});

document.getElementById('custom-css').addEventListener('click', () => copy(toCss(custom.colors), 'Skopiowano CSS'));
document.getElementById('custom-json').addEventListener('click', () => copy(toJson(customPalette()), 'Skopiowano JSON'));

document.getElementById('custom-download').addEventListener('click', () => {
  const p = customPalette();
  const blob = new Blob([toJson(p) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `paleta-${p.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

setCustom(custom);
