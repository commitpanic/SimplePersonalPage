/**
 * sections/station.js – Station Info section editor
 * data: { items: [ { key, value } ] }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderStationEditor(container, section, onSaved) {
    const d    = section.data || {};
    let items  = (d.items || []).map(i => ({ ...i }));

    container.innerHTML = `
<div class="editor-panel active">
    <div class="panel-title"><i class="fas fa-radio"></i> Station Information</div>
    <div class="panel-subtitle">Key-value pairs displayed as station info cards</div>

    <div class="field-group">
        <label for="sta-title">Section Title</label>
        <input type="text" id="sta-title" value="${_esc(section.title || '')}" placeholder="Station Information">
    </div>

    <div class="field-group" style="display:flex;align-items:flex-end;">
        <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:normal;font-weight:600;color:var(--text);cursor:pointer;margin:0;">
            <input type="checkbox" id="sta-hide-title" ${(d.hide_title ? 'checked' : '')} style="width:auto;">
            Hide title on generated page
        </label>
    </div>

    <div class="field-group">
        <label>Station Details <span style="color:var(--text-muted);font-weight:400;text-transform:none;font-size:0.78rem;">— drag to reorder</span></label>
        <div class="kv-grid" id="kv-grid"></div>
        <button class="btn btn-secondary btn-sm" id="btn-add-kv">
            <i class="fas fa-plus"></i> Add Row
        </button>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-station">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="sta-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    let dragSrc = -1;
    renderGrid();

    container.querySelector('#btn-add-kv').addEventListener('click', () => {
        items.push({ key: '', value: '' });
        renderGrid();
    });

    container.querySelector('#btn-save-station').addEventListener('click', () => {
        const title = container.querySelector('#sta-title').value.trim();
        collectGrid();
        const data = { items, hide_title: container.querySelector('#sta-hide-title').checked };
        updateSection(section.id, title, data, section.visible);
        const fb = container.querySelector('#sta-feedback');
        fb.textContent = 'Saved!';
        setTimeout(() => { fb.textContent = ''; }, 2000);
        if (onSaved) onSaved();
    });

    function renderGrid() {
        const grid = container.querySelector('#kv-grid');
        grid.innerHTML = '';
        items.forEach((item, i) => {
            const row = document.createElement('div');
            row.className = 'kv-row';
            row.draggable = true;
            row.innerHTML = `
                <input type="text" data-i="${i}" data-f="key"   placeholder="e.g. Primary Rig"   value="${_esc(item.key   || '')}">
                <textarea data-i="${i}" data-f="value" placeholder="e.g. Yaesu FT-710&#10;(Enter = new line)" rows="2" style="resize:vertical;">${_esc(item.value || '')}</textarea>
                <button class="btn btn-danger btn-icon btn-sm" data-rm="${i}" title="Remove"><i class="fas fa-trash"></i></button>`;

            row.querySelector(`[data-rm="${i}"]`).addEventListener('click', () => {
                items.splice(i, 1);
                renderGrid();
            });
            for (const input of row.querySelectorAll('input, textarea')) {
                input.addEventListener('input', () => {
                    items[parseInt(input.dataset.i)][input.dataset.f] = input.value;
                });
            }

            // Drag-to-reorder
            row.addEventListener('dragstart', () => { dragSrc = i; row.classList.add('dragging'); });
            row.addEventListener('dragend',   () => { dragSrc = -1; row.classList.remove('dragging'); });
            row.addEventListener('dragover',  e => { e.preventDefault(); row.style.borderTop = '2px solid var(--accent)'; });
            row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
            row.addEventListener('drop', e => {
                e.preventDefault();
                row.style.borderTop = '';
                if (dragSrc < 0 || dragSrc === i) return;
                const moved = items.splice(dragSrc, 1)[0];
                items.splice(i, 0, moved);
                renderGrid();
            });

            grid.appendChild(row);
        });
    }

    function collectGrid() {
        const rows = container.querySelectorAll('.kv-row');
        items = Array.from(rows).map(row => ({
            key:   row.querySelector('[data-f="key"]')?.value.trim()   || '',
            value: row.querySelector('[data-f="value"]')?.value || '',
        })).filter(r => r.key || r.value);
    }
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
