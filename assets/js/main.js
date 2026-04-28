const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear().toString();
}

// ── Theme switcher ────────────────────────────────────────────
const THEMES = [
  {
    id: 'deep-teal',
    name: 'Deep Teal',
    swatches: ['#222222', '#044343', '#3ecfcf', '#e4e4e4'],
  },
  {
    id: 'indigo-night',
    name: 'Indigo Night',
    swatches: ['#0c0e1a', '#181c30', '#818cf8', '#e4e8f5'],
  },
  {
    id: 'amber-dusk',
    name: 'Amber Dusk',
    swatches: ['#100e0a', '#201c14', '#be954e', '#f2e8d5'],
  },
  {
    id: 'forest',
    name: 'Forest',
    swatches: ['#2c3930', '#3f4f44', '#a27b5c', '#dcd7c9'],
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    swatches: ['#121212', '#1e1e1e', '#888888', '#e0e0e0'],
  },
];

const DEFAULT_THEME = 'forest';

function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id);
  localStorage.setItem('sp3fck-theme', id);
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === id);
  });
}

const themeBtn = document.getElementById('theme-btn');
const themeMenu = document.getElementById('theme-menu');

if (themeBtn && themeMenu) {
  THEMES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'theme-option';
    btn.dataset.theme = t.id;
    btn.innerHTML =
      `<span class="theme-swatches">${t.swatches.map(c => `<span class="swatch" style="background:${c}"></span>`).join('')}</span>${t.name}`;
    btn.addEventListener('click', () => {
      applyTheme(t.id);
      themeMenu.classList.remove('open');
    });
    themeMenu.appendChild(btn);
  });

  themeBtn.addEventListener('click', e => {
    e.stopPropagation();
    themeMenu.classList.toggle('open');
  });

  document.addEventListener('click', () => themeMenu.classList.remove('open'));
  themeMenu.addEventListener('click', e => e.stopPropagation());

  // apply saved or default and mark active
  const saved = localStorage.getItem('sp3fck-theme');
  applyTheme(THEMES.find(t => t.id === saved) ? saved : DEFAULT_THEME);
}
