/**
 * theme.js – Theme editor panel: color pickers, presets, font selector, live preview
 */

'use strict';

import { getTheme, saveTheme } from './db.js';

// ── Presets ────────────────────────────────────────────────────────────────────
export const THEME_PRESETS = {
    // ── Dark themes ───────────────────────────────────────
    amber: {
        label: 'Dark Amber',
        dot: '#be954e',
        dark: true,
        primary_color:      '#be954e',
        secondary_color:    '#2563eb',
        bg_color:           '#151518',
        text_color:         '#e7e5df',
        accent_color:       '#ff0000',
        h2_color:           '#be954e',
        section_bg:         '#1c1c21',
        header_bg:          '#000000',
        header_text_color:  '#ffffff',
        font_family:        'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    red: {
        label: 'Dark Red',
        dot: '#dc2626',
        dark: true,
        primary_color:      '#dc2626',
        secondary_color:    '#ef4444',
        bg_color:           '#150f0f',
        text_color:         '#f5e8e8',
        accent_color:       '#f59e0b',
        h2_color:           '#ef4444',
        section_bg:         '#1c1010',
        header_bg:          '#0d0505',
        header_text_color:  '#f5e8e8',
        font_family:        'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    blue: {
        label: 'Deep Blue',
        dot: '#2563eb',
        dark: true,
        primary_color:      '#2563eb',
        secondary_color:    '#7c3aed',
        bg_color:           '#0f1221',
        text_color:         '#dde4f0',
        accent_color:       '#22d3ee',
        h2_color:           '#60a5fa',
        section_bg:         '#141730',
        header_bg:          '#080c1a',
        header_text_color:  '#dde4f0',
        font_family:        'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    green: {
        label: 'Forest Green',
        dot: '#16a34a',
        dark: true,
        primary_color:      '#16a34a',
        secondary_color:    '#0d9488',
        bg_color:           '#0d1512',
        text_color:         '#dcf2e4',
        accent_color:       '#facc15',
        h2_color:           '#4ade80',
        section_bg:         '#111a14',
        header_bg:          '#060d08',
        header_text_color:  '#dcf2e4',
        font_family:        'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    purple: {
        label: 'Dark Purple',
        dot: '#9333ea',
        dark: true,
        primary_color:      '#9333ea',
        secondary_color:    '#ec4899',
        bg_color:           '#130d1e',
        text_color:         '#ede8f5',
        accent_color:       '#f472b6',
        h2_color:           '#c084fc',
        section_bg:         '#1a0f2e',
        header_bg:          '#0c0716',
        header_text_color:  '#ede8f5',
        font_family:        'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    midnight: {
        label: 'Midnight',
        dot: '#64748b',
        dark: true,
        primary_color:      '#94a3b8',
        secondary_color:    '#38bdf8',
        bg_color:           '#020617',
        text_color:         '#e2e8f0',
        accent_color:       '#f59e0b',
        h2_color:           '#94a3b8',
        section_bg:         '#060d25',
        header_bg:          '#000308',
        header_text_color:  '#e2e8f0',
        font_family:        "'Trebuchet MS', Helvetica, sans-serif"
    },
    // ── Light themes ──────────────────────────────────────
    clean_white: {
        label: 'Clean White',
        dot: '#6366f1',
        dark: false,
        primary_color:   '#6366f1',
        secondary_color: '#a78bfa',
        bg_color:        '#f8fafc',
        text_color:      '#1e293b',
        accent_color:    '#38bdf8',
        h2_color:           '#4f46e5',
        section_bg:         '#ffffff',
        header_bg:          '#e0e7ff',
        header_text_color:  '#1e293b',
        font_family:     'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    warm_parchment: {
        label: 'Warm Parchment',
        dot: '#f59e0b',
        dark: false,
        primary_color:   '#f59e0b',
        secondary_color: '#fb923c',
        bg_color:        '#fefce8',
        text_color:      '#292524',
        accent_color:    '#fbbf24',
        h2_color:           '#92400e',
        section_bg:         '#fffbeb',
        header_bg:          '#fef3c7',
        header_text_color:  '#292524',
        font_family:     'Georgia, Times New Roman, serif'
    },
    cool_slate: {
        label: 'Cool Slate',
        dot: '#38bdf8',
        dark: false,
        primary_color:   '#38bdf8',
        secondary_color: '#818cf8',
        bg_color:        '#f1f5f9',
        text_color:      '#0f172a',
        accent_color:    '#22d3ee',
        h2_color:           '#0369a1',
        section_bg:         '#e2e8f0',
        header_bg:          '#bae6fd',
        header_text_color:  '#0f172a',
        font_family:     'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    nature_green: {
        label: 'Nature Green',
        dot: '#4ade80',
        dark: false,
        primary_color:   '#4ade80',
        secondary_color: '#34d399',
        bg_color:        '#f0fdf4',
        text_color:      '#052e16',
        accent_color:    '#a3e635',
        h2_color:           '#15803d',
        section_bg:         '#dcfce7',
        header_bg:          '#bbf7d0',
        header_text_color:  '#052e16',
        font_family:     'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    rose_blush: {
        label: 'Rose Blush',
        dot: '#fb7185',
        dark: false,
        primary_color:   '#fb7185',
        secondary_color: '#f472b6',
        bg_color:        '#fff1f2',
        text_color:      '#1c1917',
        accent_color:    '#fda4af',
        h2_color:           '#be123c',
        section_bg:         '#ffe4e6',
        header_bg:          '#fecdd3',
        header_text_color:  '#1c1917',
        font_family:     'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
};

const FONT_OPTIONS = [
    'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    'Arial, Helvetica, sans-serif',
    'Georgia, Times New Roman, serif',
    'Courier New, Courier, monospace',
    "'Trebuchet MS', Helvetica, sans-serif"
];

// ── Render ─────────────────────────────────────────────────────────────────────

/**
 * Render the theme editor into `container` for `projectId`.
 * `onSaved(theme)` is called after saving.
 */
export function renderThemeEditor(container, projectId, onSaved) {
    const theme = getTheme(projectId) || THEME_PRESETS.amber;

    container.innerHTML = `
<div class="editor-panel active" id="panel-theme">
    <div class="panel-title"><i class="fas fa-palette"></i> Theme &amp; Colors</div>
    <div class="panel-subtitle">Customize the color scheme and font of your QRZ page</div>

    <!-- Presets -->
    <div class="field-group">
        <label>Quick Presets</label>
        <div class="theme-presets" id="theme-presets"></div>
    </div>

    <!-- Custom color pickers -->
    <div class="theme-custom-header">
        <span>🎨 Custom Colors</span>
        <span class="theme-custom-hint">Pick any colors to build your own palette</span>
    </div>
    <div class="theme-grid" id="theme-grid"></div>

    <!-- Font -->
    <div class="field-group">
        <label for="theme-font">Font Family</label>
        <select id="theme-font"></select>
    </div>

    <!-- Save bar -->
    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-theme-save">
            <i class="fas fa-save"></i> Save Theme
        </button>
        <span id="theme-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    // Build presets
    const presetsEl = container.querySelector('#theme-presets');
    let lastDark = null;
    for (const [key, preset] of Object.entries(THEME_PRESETS)) {
        // Section header when dark/light group changes
        if (lastDark === null || lastDark !== (preset.dark !== false)) {
            const lbl = document.createElement('div');
            lbl.className = 'presets-group-label';
            lbl.textContent = preset.dark !== false ? '🌙 Dark' : '☀️ Light';
            presetsEl.appendChild(lbl);
            lastDark = preset.dark !== false;
        }
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.innerHTML = `<span class="preset-dot" style="background:${preset.dot};${preset.dark === false ? 'border:1px solid #ccc;' : ''}"></span>${preset.label}`;
        btn.addEventListener('click', () => applyPreset(preset));
        presetsEl.appendChild(btn);
    }

    // Build color swatches
    const COLORS = [
        { key: 'primary_color',      label: 'Primary Color',        hint: 'Main accent — headings, highlights' },
        { key: 'secondary_color',    label: 'Secondary Color',      hint: 'Buttons, links, badges' },
        { key: 'bg_color',           label: 'Background',           hint: 'Page background color' },
        { key: 'text_color',         label: 'Text Color',           hint: 'Main body text' },
        { key: 'accent_color',       label: 'Accent Color',         hint: 'Special accents, YouTube section' },
        { key: 'h2_color',           label: 'Section Heading Color',hint: 'h2 headings in sections below header' },
        { key: 'section_bg',         label: 'Card / Box Background',  hint: 'Inner boxes: station cards, embed frames, map container, propagation widget' },
        { key: 'header_bg',          label: 'Header Background',    hint: 'Top header bar background' },
        { key: 'header_text_color',  label: 'Header Text Color',    hint: 'Callsign and location text in header' },
    ];

    const gridEl = container.querySelector('#theme-grid');
    for (const c of COLORS) {
        const lbl = document.createElement('label');
        lbl.className = 'color-swatch';
        lbl.htmlFor = `color-${c.key}`;
        lbl.innerHTML = `
            <input type="color" id="color-${c.key}" value="${theme[c.key] || '#be954e'}" title="${c.hint}">
            <div class="color-swatch-info">
                <div class="color-swatch-label">${c.label}</div>
                <div class="color-swatch-hint">${c.hint}</div>
                <div class="color-swatch-value" id="val-${c.key}">${theme[c.key] || '#be954e'}</div>
            </div>`;
        const input = lbl.querySelector('input');
        input.addEventListener('input', () => {
            lbl.querySelector('.color-swatch-value').textContent = input.value;
            applyLivePreview();
        });
        gridEl.appendChild(lbl);
    }

    // Font select
    const fontSel = container.querySelector('#theme-font');
    for (const f of FONT_OPTIONS) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f.split(',')[0].replace(/'/g, '').trim();
        if (f === (theme.font_family || FONT_OPTIONS[0])) opt.selected = true;
        fontSel.appendChild(opt);
    }

    applyLivePreview();

    container.querySelector('#btn-theme-save').addEventListener('click', () => {
        const data = _collectTheme(container);
        saveTheme(projectId, data);
        applyLivePreview();
        const fb = container.querySelector('#theme-feedback');
        fb.textContent = 'Saved!';
        setTimeout(() => { fb.textContent = ''; }, 2000);
        if (onSaved) onSaved(data);
    });

    function applyPreset(preset) {
        for (const c of COLORS) {
            const input = container.querySelector(`#color-${c.key}`);
            if (input) {
                input.value = preset[c.key];
                container.querySelector(`#val-${c.key}`).textContent = preset[c.key];
            }
        }
        const fs = container.querySelector('#theme-font');
        if (fs) {
            for (const opt of fs.options) {
                if (opt.value === preset.font_family) { opt.selected = true; break; }
            }
        }
        applyLivePreview();
    }

    function applyLivePreview() {
        const data = _collectTheme(container);
        // Update CSS variables on :root for the builder UI preview
        document.documentElement.style.setProperty('--preview-primary',   data.primary_color);
        document.documentElement.style.setProperty('--preview-secondary', data.secondary_color);
        document.documentElement.style.setProperty('--preview-bg',        data.bg_color);
        document.documentElement.style.setProperty('--preview-text',      data.text_color);
        document.documentElement.style.setProperty('--preview-accent',    data.accent_color);
        // Refresh preview iframe if present
        const frame = document.getElementById('preview-frame');
        if (frame && frame._refresh) frame._refresh();
    }
}

function _collectTheme(container) {
    return {
        primary_color:      container.querySelector('#color-primary_color')?.value      || '#be954e',
        secondary_color:    container.querySelector('#color-secondary_color')?.value    || '#2563eb',
        bg_color:           container.querySelector('#color-bg_color')?.value           || '#151518',
        text_color:         container.querySelector('#color-text_color')?.value         || '#e7e5df',
        accent_color:       container.querySelector('#color-accent_color')?.value       || '#ff0000',
        h2_color:           container.querySelector('#color-h2_color')?.value           || '#ffffff',
        section_bg:         container.querySelector('#color-section_bg')?.value         || '#151518',
        header_bg:          container.querySelector('#color-header_bg')?.value          || '#000000',
        header_text_color:  container.querySelector('#color-header_text_color')?.value  || '#ffffff',
        font_family:        container.querySelector('#theme-font')?.value               || FONT_OPTIONS[0]
    };
}
