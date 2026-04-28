/**
 * sections/gridimg.js - Grid IMG section editor
 * data: {
 *   icon_class,
 *   icon_color,
 *   columns,
 *   hide_title,
 *   items: [ { imageUrl, alt, caption, linkUrl } ]
 * }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderGridImgEditor(container, section, onSaved) {
    const d = section.data || {};
    let items = (d.items || []).map(i => ({ ...i }));
    let editIdx = -1;
    let dragSrc = -1;

    container.innerHTML = `
<div class="editor-panel active" style="max-width:900px;">
    <div class="panel-title"><i class="fas fa-images"></i> Grid IMG</div>
    <div class="panel-subtitle">Image tiles in a responsive grid (1, 2 or 3 columns) with drag and drop ordering</div>

    <div class="field-group">
        <label for="gi-section-title">Section Title</label>
        <input type="text" id="gi-section-title" value="${_esc(section.title || 'Grid IMG')}" placeholder="e.g. Gallery Grid, My Photo Grid...">
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="gi-icon-class">Header Icon (Font Awesome class)</label>
            <input type="text" id="gi-icon-class" value="${_esc(d.icon_class || 'fas fa-images')}" placeholder="fas fa-images">
            <small style="color:var(--text-muted);margin-top:6px;display:block;">
                Find icon classes at <a href="https://fontawesome.com/search" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;">Font Awesome Search</a>
            </small>
        </div>
        <div class="field-group">
            <label for="gi-icon-color">Header Icon Color</label>
            <input type="color" id="gi-icon-color" value="${_esc(d.icon_color || '#be954e')}">
        </div>
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="gi-columns">Grid Columns</label>
            <select id="gi-columns">
                <option value="3" ${(Number(d.columns || 3) === 3) ? 'selected' : ''}>3 columns</option>
                <option value="2" ${(Number(d.columns || 3) === 2) ? 'selected' : ''}>2 columns</option>
                <option value="1" ${(Number(d.columns || 3) === 1) ? 'selected' : ''}>1 column</option>
            </select>
        </div>
        <div class="field-group" style="display:flex;align-items:flex-end;">
            <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:normal;font-weight:600;color:var(--text);cursor:pointer;margin:0;">
                <input type="checkbox" id="gi-hide-title" ${(d.hide_title ? 'checked' : '')} style="width:auto;">
                Hide title on generated page
            </label>
        </div>
    </div>

    <div class="add-item-form" style="margin-top:0;">
        <h4><i class="fas fa-eye" style="color:var(--accent);"></i> Live Grid Preview</h4>
        <div id="gi-preview-wrap" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;">
            <div id="gi-preview-title" style="font-size:1rem;font-weight:700;margin-bottom:10px;color:var(--text);"></div>
            <div id="gi-preview-grid" style="display:grid;gap:8px;"></div>
        </div>
    </div>

    <div class="items-grid" id="gi-list"></div>

    <div class="add-item-form">
        <h4><i class="fas fa-plus-circle" style="color:var(--accent);"></i> Add New Tile</h4>
        <img id="gi-add-preview" class="preview-img-small" alt="Preview">
        <div class="field-group">
            <label>Image URL <span style="color:#ef4444;">*</span></label>
            <div class="url-row">
                <input type="url" id="gi-add-url" placeholder="https://static.qrz.com/..." oninput="window._giPreviewAdd()">
                <button class="btn btn-secondary btn-icon" onclick="window._giPreviewAdd(true)" title="Preview"><i class="fas fa-search"></i></button>
            </div>
        </div>
        <div class="field-row">
            <div class="field-group">
                <label>Alt Text</label>
                <input type="text" id="gi-add-alt" placeholder="Accessibility description">
            </div>
            <div class="field-group">
                <label>Caption</label>
                <input type="text" id="gi-add-caption" placeholder="Optional caption under image">
            </div>
        </div>
        <div class="field-group">
            <label>Link URL</label>
            <input type="url" id="gi-add-link" placeholder="https://... (optional)">
        </div>
        <button class="btn btn-primary" id="gi-btn-add"><i class="fas fa-plus"></i> Add Tile</button>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-gi">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="gi-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>

<div class="modal-overlay" id="gi-edit-modal" onclick="if(event.target===this)window._giCloseModal()">
    <div class="modal-card">
        <h2><i class="fas fa-images" style="color:var(--accent);"></i> Edit Tile</h2>
        <img id="gi-edit-preview" class="preview-img-small" alt="Preview" style="display:block;height:120px;">
        <div class="field-group">
            <label>Image URL <span style="color:#ef4444;">*</span></label>
            <div class="url-row">
                <input type="url" id="gi-edit-url" placeholder="https://..." oninput="window._giPreviewEdit()">
                <button class="btn btn-secondary btn-icon" onclick="window._giPreviewEdit(true)"><i class="fas fa-search"></i></button>
            </div>
        </div>
        <div class="field-row">
            <div class="field-group">
                <label>Alt Text</label>
                <input type="text" id="gi-edit-alt">
            </div>
            <div class="field-group">
                <label>Caption</label>
                <input type="text" id="gi-edit-caption">
            </div>
        </div>
        <div class="field-group">
            <label>Link URL</label>
            <input type="url" id="gi-edit-link">
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="window._giCloseModal()">Cancel</button>
            <button class="btn btn-primary" id="gi-btn-save-edit"><i class="fas fa-save"></i> Save</button>
        </div>
    </div>
</div>`;

    renderList();
    renderLivePreview();

    container.querySelector('#gi-columns').addEventListener('change', renderLivePreview);
    container.querySelector('#gi-hide-title').addEventListener('change', renderLivePreview);
    container.querySelector('#gi-section-title').addEventListener('input', renderLivePreview);

    window._giPreviewAdd = (force = false) => {
        const url = container.querySelector('#gi-add-url').value.trim();
        const img = container.querySelector('#gi-add-preview');
        if (url && (force || url.startsWith('http'))) {
            img.src = url;
            img.style.display = 'block';
        }
    };
    window._giPreviewEdit = (force = false) => {
        const url = container.querySelector('#gi-edit-url').value.trim();
        const img = container.querySelector('#gi-edit-preview');
        if (url && (force || url.startsWith('http'))) {
            img.src = url;
            img.style.display = 'block';
        }
    };
    window._giCloseModal = closeModal;

    container.querySelector('#gi-btn-add').addEventListener('click', () => {
        const imageUrl = container.querySelector('#gi-add-url').value.trim();
        if (!imageUrl) { alert('Image URL is required.'); return; }
        items.push({
            imageUrl,
            alt: container.querySelector('#gi-add-alt').value.trim(),
            caption: container.querySelector('#gi-add-caption').value.trim(),
            linkUrl: container.querySelector('#gi-add-link').value.trim(),
        });
        clearAddForm();
        renderList();
        renderLivePreview();
    });

    container.querySelector('#gi-btn-save-edit').addEventListener('click', () => {
        if (editIdx < 0) return;
        const imageUrl = container.querySelector('#gi-edit-url').value.trim();
        if (!imageUrl) { alert('Image URL is required.'); return; }
        items[editIdx] = {
            imageUrl,
            alt: container.querySelector('#gi-edit-alt').value.trim(),
            caption: container.querySelector('#gi-edit-caption').value.trim(),
            linkUrl: container.querySelector('#gi-edit-link').value.trim(),
        };
        closeModal();
        renderList();
        renderLivePreview();
    });

    container.querySelector('#btn-save-gi').addEventListener('click', () => {
        const newTitle = container.querySelector('#gi-section-title').value.trim() || 'Grid IMG';
        const columns = Number(container.querySelector('#gi-columns').value) || 3;
        const normalizedColumns = [1, 2, 3].includes(columns) ? columns : 3;
        updateSection(section.id, newTitle, {
            icon_class: container.querySelector('#gi-icon-class').value.trim() || 'fas fa-images',
            icon_color: container.querySelector('#gi-icon-color').value.trim() || '#be954e',
            columns: normalizedColumns,
            hide_title: container.querySelector('#gi-hide-title').checked,
            items,
        }, section.visible);
        const fb = container.querySelector('#gi-feedback');
        fb.textContent = `Saved! (${items.length} tiles)`;
        setTimeout(() => { fb.textContent = ''; }, 2000);
        if (onSaved) onSaved();
    });

    function renderList() {
        const list = container.querySelector('#gi-list');
        list.innerHTML = '';
        if (!items.length) {
            list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px 0;">No tiles yet. Add the first image below.</div>';
            return;
        }
        items.forEach((item, i) => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.draggable = true;
            card.innerHTML = `
                <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
                <img class="item-thumb" src="${_esc(item.imageUrl)}" alt="${_esc(item.alt || item.caption || 'Grid image')}" onerror="this.style.display='none'">
                <div class="item-info">
                    <div class="item-pos">#${i + 1}</div>
                    <div class="item-title">${_esc(item.caption || 'Untitled image')}</div>
                    <div class="item-desc">${_esc(item.alt || '')}</div>
                    ${item.linkUrl ? `<div class="item-url">${_esc(item.linkUrl)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <div class="item-actions-row">
                        <button class="btn btn-secondary btn-icon btn-sm" data-edit="${i}" title="Edit"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-danger btn-icon btn-sm" data-del="${i}" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;

            card.querySelector(`[data-edit="${i}"]`).addEventListener('click', () => openEdit(i));
            card.querySelector(`[data-del="${i}"]`).addEventListener('click', () => {
                if (confirm('Delete this tile?')) {
                    items.splice(i, 1);
                    renderList();
                    renderLivePreview();
                }
            });

            card.addEventListener('dragstart', () => { dragSrc = i; card.classList.add('dragging'); });
            card.addEventListener('dragend', () => { dragSrc = -1; card.classList.remove('dragging'); });
            card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', e => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (dragSrc < 0 || dragSrc === i) return;
                const moved = items.splice(dragSrc, 1)[0];
                items.splice(i, 0, moved);
                renderList();
                renderLivePreview();
            });

            list.appendChild(card);
        });
    }

    function openEdit(i) {
        editIdx = i;
        const item = items[i];
        container.querySelector('#gi-edit-url').value = item.imageUrl || '';
        container.querySelector('#gi-edit-alt').value = item.alt || '';
        container.querySelector('#gi-edit-caption').value = item.caption || '';
        container.querySelector('#gi-edit-link').value = item.linkUrl || '';
        const prev = container.querySelector('#gi-edit-preview');
        prev.src = item.imageUrl || '';
        prev.style.display = item.imageUrl ? 'block' : 'none';
        container.querySelector('#gi-edit-modal').classList.add('open');
    }

    function closeModal() {
        container.querySelector('#gi-edit-modal').classList.remove('open');
        editIdx = -1;
    }

    function clearAddForm() {
        container.querySelector('#gi-add-url').value = '';
        container.querySelector('#gi-add-alt').value = '';
        container.querySelector('#gi-add-caption').value = '';
        container.querySelector('#gi-add-link').value = '';
        const prev = container.querySelector('#gi-add-preview');
        prev.src = '';
        prev.style.display = 'none';
    }

    function renderLivePreview() {
        const titleEl = container.querySelector('#gi-preview-title');
        const gridEl = container.querySelector('#gi-preview-grid');
        const columns = Number(container.querySelector('#gi-columns').value) || 3;
        const hideTitle = container.querySelector('#gi-hide-title').checked;
        const title = container.querySelector('#gi-section-title').value.trim() || 'Grid IMG';

        titleEl.style.display = hideTitle ? 'none' : 'block';
        titleEl.textContent = title;

        gridEl.style.gridTemplateColumns = `repeat(${[1, 2, 3].includes(columns) ? columns : 3}, minmax(0, 1fr))`;
        gridEl.innerHTML = '';

        if (!items.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'grid-column:1/-1;color:var(--text-muted);font-size:0.82rem;padding:8px 0;text-align:center;';
            empty.textContent = 'No images yet.';
            gridEl.appendChild(empty);
            return;
        }

        items.forEach((item, idx) => {
            const tile = document.createElement('div');
            tile.style.cssText = 'border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-main);';
            const caption = item.caption ? `<div style="padding:6px 8px;font-size:0.75rem;color:var(--text);">${_esc(item.caption)}</div>` : '';
            tile.innerHTML = `
                <img src="${_esc(item.imageUrl)}" alt="${_esc(item.alt || item.caption || `Grid image ${idx + 1}`)}"
                     style="display:block;width:100%;height:90px;object-fit:cover;background:#0f0f12;" onerror="this.style.opacity='0.35';this.alt='Image error';">
                ${caption}`;
            gridEl.appendChild(tile);
        });
    }
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
