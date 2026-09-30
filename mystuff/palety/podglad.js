// ── Podgląd makiety w różnych urządzeniach ────────────────────
// URL: podglad.html?p=<id>&device=desktop|tablet|mobile|both&font=sans|serif
//      podglad.html?c=RRGGBB,RRGGBB,RRGGBB,RRGGBB,RRGGBB  (własny zestaw)
const DEVICES = {
  desktop: { w: 1366, h: null, bezel: 0 },
  tablet: { w: 820, h: 1180, bezel: 10 },
  mobile: { w: 390, h: 844, bezel: 10 },
};
const LAYOUTS = {
  desktop: ['desktop'],
  tablet: ['tablet'],
  mobile: ['mobile'],
  both: ['desktop', 'mobile'],
};
const CUSTOM_ID = '__custom';
const GAP = 24;
const PAD = 20;

const params = new URLSearchParams(location.search);
const state = {
  palette: params.get('c') ? CUSTOM_ID : params.get('p'),
  custom: params.get('c'),
  device: LAYOUTS[params.get('device')] ? params.get('device') : 'both',
  font: params.get('font') === 'serif' ? 'serif' : 'sans',
};

const stage = document.getElementById('stage');
const select = document.getElementById('palette-select');
const swatchesEl = document.getElementById('tb-swatches');
const openNew = document.getElementById('open-new');
let palettes = [];

function mockupUrl() {
  const q = new URLSearchParams();
  if (state.palette === CUSTOM_ID) q.set('c', state.custom);
  else q.set('p', state.palette);
  if (state.font === 'serif') q.set('font', 'serif');
  return `mockup.html?${q}`;
}

function syncUrl() {
  const q = new URLSearchParams();
  if (state.palette === CUSTOM_ID) q.set('c', state.custom);
  else q.set('p', state.palette);
  q.set('device', state.device);
  if (state.font === 'serif') q.set('font', 'serif');
  history.replaceState(null, '', `?${q}`);
}

function currentColors() {
  if (state.palette === CUSTOM_ID) return state.custom.split(',').map(v => '#' + v);
  const p = palettes.find(x => x.id === state.palette);
  return p ? Object.values(p.colors) : [];
}

// ── Frames ────────────────────────────────────────────────────
function buildFrames() {
  stage.innerHTML = '';
  LAYOUTS[state.device].forEach(key => {
    const frame = document.createElement('div');
    frame.className = `frame device-${key}`;
    frame.dataset.device = key;
    const iframe = document.createElement('iframe');
    iframe.title = `Makieta – ${key}`;
    iframe.src = mockupUrl();
    frame.appendChild(iframe);
    stage.appendChild(frame);
  });
  layout();
}

function layout() {
  const frames = [...stage.querySelectorAll('.frame')];
  if (!frames.length) return;
  const specs = frames.map(f => DEVICES[f.dataset.device]);
  const availW = stage.clientWidth - PAD * 2 - GAP * (frames.length - 1) - specs.reduce((s, d) => s + d.bezel * 2, 0);
  const availH = stage.clientHeight - PAD * 2;

  let scale = Math.min(1, availW / specs.reduce((s, d) => s + d.w, 0));
  specs.forEach(d => {
    if (d.h) scale = Math.min(scale, (availH - d.bezel * 2) / d.h);
  });

  frames.forEach((frame, i) => {
    const d = specs[i];
    const h = d.h || availH / scale;
    frame.style.width = `${d.w * scale}px`;
    frame.style.height = `${h * scale}px`;
    const iframe = frame.querySelector('iframe');
    iframe.style.width = `${d.w}px`;
    iframe.style.height = `${h}px`;
    iframe.style.transform = `scale(${scale})`;
  });
}

function refresh() {
  const url = mockupUrl();
  stage.querySelectorAll('iframe').forEach(f => { if (f.getAttribute('src') !== url) f.src = url; });
  swatchesEl.innerHTML = currentColors().map(c => `<span style="background:${c}" title="${c}"></span>`).join('');
  openNew.href = url;
  select.value = state.palette;
  syncUrl();
}

function markActive() {
  document.querySelectorAll('[data-device]').forEach(b => {
    if (b.tagName === 'BUTTON') b.classList.toggle('active', b.dataset.device === state.device);
  });
  document.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('active', b.dataset.font === state.font));
}

// ── Controls ──────────────────────────────────────────────────
function step(dir) {
  const ids = [...select.options].map(o => o.value);
  const i = ids.indexOf(state.palette);
  state.palette = ids[(i + dir + ids.length) % ids.length];
  refresh();
}

select.addEventListener('change', () => {
  state.palette = select.value;
  refresh();
});

document.getElementById('prev').addEventListener('click', () => step(-1));
document.getElementById('next').addEventListener('click', () => step(1));

document.addEventListener('keydown', e => {
  if (e.target === select) return;
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

document.querySelectorAll('button[data-device]').forEach(b => b.addEventListener('click', () => {
  state.device = b.dataset.device;
  markActive();
  buildFrames();
  syncUrl();
}));

document.querySelectorAll('button[data-font]').forEach(b => b.addEventListener('click', () => {
  state.font = b.dataset.font;
  markActive();
  refresh();
}));

window.addEventListener('resize', layout);

// ── Init ──────────────────────────────────────────────────────
fetch('palettes.json', { cache: 'no-cache' })
  .then(r => r.json())
  .then(data => {
    palettes = data.palettes;
    const options = palettes.map((p, i) => `<option value="${p.id}">${String(i + 1).padStart(2, '0')}. ${p.name}</option>`);
    if (state.custom) options.push(`<option value="${CUSTOM_ID}">★ Własny zestaw</option>`);
    select.innerHTML = options.join('');
    if (state.palette !== CUSTOM_ID && !palettes.some(p => p.id === state.palette)) {
      state.palette = palettes[0].id;
    }
    markActive();
    buildFrames();
    refresh();
  });
