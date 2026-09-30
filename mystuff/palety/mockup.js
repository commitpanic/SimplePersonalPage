// ── Makieta: wczytuje paletę z ?p=<id> albo ?c=RRGGBB,... ─────
// Opcjonalnie ?font=serif (nagłówki szeryfowe, ostrzejsze rogi).
const ROLE_KEYS = ['background', 'surface', 'text', 'primary', 'accent'];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readableOn(hex) {
  const l = luminance(hex);
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / (luminance('#111111') + 0.05)) ? '#FFFFFF' : '#111111';
}

function applyColors(colors) {
  const root = document.documentElement.style;
  ROLE_KEYS.forEach(k => root.setProperty(`--${k}`, colors[k]));
  root.setProperty('--on-primary', readableOn(colors.primary));
  root.setProperty('--on-accent', readableOn(colors.accent));
}

const params = new URLSearchParams(location.search);

if (params.get('font') === 'serif') {
  document.documentElement.dataset.font = 'serif';
}

const custom = (params.get('c') || '').split(',').map(v => v.trim().replace(/^#/, ''));
if (custom.length === ROLE_KEYS.length && custom.every(v => /^[0-9a-f]{6}$/i.test(v))) {
  applyColors(Object.fromEntries(ROLE_KEYS.map((k, i) => [k, '#' + custom[i]])));
} else if (params.get('p')) {
  fetch('palettes.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(data => {
      const p = data.palettes.find(x => x.id === params.get('p'));
      if (p) {
        applyColors(p.colors);
        document.title = `Makieta – ${p.name}`;
      }
    })
    .catch(() => { /* zostają kolory domyślne z CSS */ });
}

// ── Ułatwienia dostępu: rozmiar tekstu i wysoki kontrast ─────
const store = {
  get: key => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, val); } catch { /* tryb prywatny */ } },
};
const SIZE_KEY = 'mockup-a11y-size';
const HC_KEY = 'mockup-a11y-hc';
const contrastBtn = document.getElementById('a11y-contrast');
let currentSize = parseInt(store.get(SIZE_KEY) || '0', 10);

function applySize() {
  document.documentElement.style.fontSize = currentSize === 0 ? '' : `${100 + currentSize * 10}%`;
  store.set(SIZE_KEY, currentSize);
}

function applyContrast(isHC) {
  document.body.classList.toggle('hc-mode', isHC);
  contrastBtn.classList.toggle('a11y-active', isHC);
  contrastBtn.setAttribute('aria-pressed', String(isHC));
  store.set(HC_KEY, isHC ? '1' : '0');
}

if (currentSize !== 0) applySize();
if (store.get(HC_KEY) === '1') applyContrast(true);

document.getElementById('a11y-increase').addEventListener('click', () => {
  if (currentSize >= 3) return;
  currentSize++;
  applySize();
});

document.getElementById('a11y-decrease').addEventListener('click', () => {
  if (currentSize <= -1) return;
  currentSize--;
  applySize();
});

document.getElementById('a11y-reset').addEventListener('click', () => {
  currentSize = 0;
  applySize();
});

contrastBtn.addEventListener('click', () => {
  applyContrast(!document.body.classList.contains('hc-mode'));
});

// Synchronizacja między makietami w podglądzie (desktop + telefon)
window.addEventListener('storage', e => {
  if (e.key === SIZE_KEY) {
    currentSize = parseInt(e.newValue || '0', 10);
    document.documentElement.style.fontSize = currentSize === 0 ? '' : `${100 + currentSize * 10}%`;
  }
  if (e.key === HC_KEY) applyContrast(e.newValue === '1');
});

// ── Menu mobilne ──────────────────────────────────────────────
const burger = document.getElementById('burger');
const links = document.getElementById('nav-links');

burger.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
  burger.innerHTML = `<i class="fa-solid fa-${open ? 'xmark' : 'bars'}"></i>`;
});

links.addEventListener('click', e => {
  if (e.target.closest('a')) {
    links.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
  }
});
