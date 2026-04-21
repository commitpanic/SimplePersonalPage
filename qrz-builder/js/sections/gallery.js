/**
 * sections/gallery.js – Awards Gallery section editor
 * Ported from gallery-manager.html logic.
 * data: { icon_class, icon_color, theme_color, slides: [ { imageUrl, alt, title, description, year } ] }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderGalleryEditor(container, section, onSaved) {
    const d      = section.data || {};
    let slides   = (d.slides || []).map(s => ({ ...s }));
    let editIdx  = -1;
    let dragSrc  = -1;

    container.innerHTML = `
<div class="editor-panel active" style="max-width:900px;">
    <div class="panel-title"><i class="fas fa-trophy"></i> Gallery</div>
    <div class="panel-subtitle">Manage slides shown in the CSS-only gallery carousel</div>

    <div class="field-group">
        <label for="gal-section-title">Section Title</label>
        <input type="text" id="gal-section-title" value="${_esc(section.title || 'Gallery')}" placeholder="e.g. Awards Gallery, Ham Awards, My Gallery…">
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="gal-icon-class">Header Icon (Font Awesome class)</label>
            <input type="text" id="gal-icon-class" value="${_esc(d.icon_class || 'fas fa-trophy')}" placeholder="fas fa-trophy">
            <small style="color:var(--text-muted);margin-top:6px;display:block;">
                Find icon classes at <a href="https://fontawesome.com/search" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;">Font Awesome Search</a>
            </small>
        </div>
        <div class="field-group">
            <label for="gal-icon-color">Header Icon Color</label>
            <input type="color" id="gal-icon-color" value="${_esc(d.icon_color || '#be954e')}">
        </div>
    </div>

    <div class="field-group">
        <label for="gal-theme-color">Gallery Theme Color</label>
        <input type="color" id="gal-theme-color" value="${_esc(d.theme_color || '#3b82f6')}">
    </div>

    <div class="items-grid" id="gallery-list"></div>

    <!-- Add form -->
    <div class="add-item-form">
        <h4><i class="fas fa-plus-circle" style="color:var(--accent);"></i> Add New Slide</h4>
        <img id="gal-add-preview" class="preview-img-small" alt="Preview">
        <div class="field-group">
            <label>Image URL <span style="color:#ef4444;">*</span></label>
            <div class="url-row">
                <input type="url" id="gal-add-url" placeholder="https://static.qrz.com/…" oninput="window._galPreviewAdd()">
                <button class="btn btn-secondary btn-icon" onclick="window._galPreviewAdd(true)" title="Preview"><i class="fas fa-search"></i></button>
            </div>
        </div>
        <div class="field-row">
            <div class="field-group">
                <label>Title <span style="color:#ef4444;">*</span></label>
                <input type="text" id="gal-add-title" placeholder="Award title">
            </div>
            <div class="field-group">
                <label>Year</label>
                <input type="text" id="gal-add-year" value="${new Date().getFullYear()}" placeholder="${new Date().getFullYear()}">
            </div>
        </div>
        <div class="field-group">
            <label>Description</label>
            <input type="text" id="gal-add-desc" placeholder="Short description">
        </div>
        <div class="field-group">
            <label>Alt Text</label>
            <input type="text" id="gal-add-alt" placeholder="Accessibility description">
        </div>
        <button class="btn btn-primary" id="gal-btn-add"><i class="fas fa-plus"></i> Add Slide</button>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-gallery">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="gal-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>

<!-- Edit Modal -->
<div class="modal-overlay" id="gal-edit-modal" onclick="if(event.target===this)window._galCloseModal()">
    <div class="modal-card">
        <h2><i class="fas fa-image" style="color:var(--accent);"></i> Edit Slide</h2>
        <img id="gal-edit-preview" class="preview-img-small" alt="Preview" style="display:block;height:120px;">
        <div class="field-group">
            <label>Image URL <span style="color:#ef4444;">*</span></label>
            <div class="url-row">
                <input type="url" id="gal-edit-url" placeholder="https://static.qrz.com/…" oninput="window._galPreviewEdit()">
                <button class="btn btn-secondary btn-icon" onclick="window._galPreviewEdit(true)"><i class="fas fa-search"></i></button>
            </div>
        </div>
        <div class="field-row">
            <div class="field-group">
                <label>Title <span style="color:#ef4444;">*</span></label>
                <input type="text" id="gal-edit-title">
            </div>
            <div class="field-group">
                <label>Year</label>
                <input type="text" id="gal-edit-year">
            </div>
        </div>
        <div class="field-group">
            <label>Description</label>
            <input type="text" id="gal-edit-desc">
        </div>
        <div class="field-group">
            <label>Alt Text</label>
            <input type="text" id="gal-edit-alt">
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="window._galCloseModal()">Cancel</button>
            <button class="btn btn-primary" id="gal-btn-save-edit"><i class="fas fa-save"></i> Save</button>
        </div>
    </div>
</div>`;

    renderList();

    // ── Image preview helpers exposed as globals (needed for inline oninput) ──
    window._galPreviewAdd = (force = false) => {
        const url = container.querySelector('#gal-add-url').value.trim();
        const img = container.querySelector('#gal-add-preview');
        if (url && (force || url.startsWith('http'))) {
            img.src = url;
            img.style.display = 'block';
        }
    };
    window._galPreviewEdit = (force = false) => {
        const url = container.querySelector('#gal-edit-url').value.trim();
        const img = container.querySelector('#gal-edit-preview');
        if (url && (force || url.startsWith('http'))) {
            img.src = url;
            img.style.display = 'block';
        }
    };
    window._galCloseModal = closeModal;

    // ── Add slide ──────────────────────────────────────────
    container.querySelector('#gal-btn-add').addEventListener('click', () => {
        const url   = container.querySelector('#gal-add-url').value.trim();
        const title = container.querySelector('#gal-add-title').value.trim();
        if (!url)   { alert('Image URL is required.'); return; }
        if (!title) { alert('Title is required.');     return; }

        slides.push({
            imageUrl:    url,
            alt:         container.querySelector('#gal-add-alt').value.trim(),
            title,
            description: container.querySelector('#gal-add-desc').value.trim(),
            year:        container.querySelector('#gal-add-year').value.trim() || String(new Date().getFullYear()),
        });
        clearAddForm();
        renderList();
    });

    // ── Edit modal ─────────────────────────────────────────
    container.querySelector('#gal-btn-save-edit').addEventListener('click', () => {
        if (editIdx < 0) return;
        const url   = container.querySelector('#gal-edit-url').value.trim();
        const title = container.querySelector('#gal-edit-title').value.trim();
        if (!url || !title) { alert('URL and title are required.'); return; }
        slides[editIdx] = {
            imageUrl:    url,
            alt:         container.querySelector('#gal-edit-alt').value.trim(),
            title,
            description: container.querySelector('#gal-edit-desc').value.trim(),
            year:        container.querySelector('#gal-edit-year').value.trim() || String(new Date().getFullYear()),
        };
        closeModal();
        renderList();
    });

    // ── Save ───────────────────────────────────────────────
    container.querySelector('#btn-save-gallery').addEventListener('click', () => {
        const newTitle = container.querySelector('#gal-section-title').value.trim() || 'Gallery';
        updateSection(section.id, newTitle, {
            icon_class: container.querySelector('#gal-icon-class').value.trim() || 'fas fa-trophy',
            icon_color: container.querySelector('#gal-icon-color').value.trim() || '#be954e',
            theme_color: container.querySelector('#gal-theme-color').value.trim() || '#3b82f6',
            slides,
        }, section.visible);
        const fb = container.querySelector('#gal-feedback');
        fb.textContent = `Saved! (${slides.length} slides)`;
        setTimeout(() => { fb.textContent = ''; }, 2000);
        if (onSaved) onSaved();
    });

    // ── Helpers ────────────────────────────────────────────
    function renderList() {
        const list = container.querySelector('#gallery-list');
        list.innerHTML = '';
        if (!slides.length) {
            list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px 0;">No slides yet. Add the first one below.</div>';
            return;
        }
        slides.forEach((s, i) => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.draggable = true;
            card.innerHTML = `
                <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
                <img class="item-thumb" src="${_esc(s.imageUrl)}" alt="${_esc(s.alt || s.title)}" onerror="this.style.display='none'">
                <div class="item-info">
                    <div class="item-pos">#${i + 1}</div>
                    <div class="item-title">${_esc(s.title)}</div>
                    <div class="item-desc">${_esc(s.description || '')}</div>
                </div>
                <div class="item-actions">
                    <div class="item-actions-row">
                        <button class="btn btn-secondary btn-icon btn-sm" data-edit="${i}" title="Edit"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-danger btn-icon btn-sm"    data-del="${i}"  title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;

            card.querySelector(`[data-edit="${i}"]`).addEventListener('click', () => openEdit(i));
            card.querySelector(`[data-del="${i}"]`).addEventListener('click', () => {
                if (confirm(`Delete "${s.title}"?`)) { slides.splice(i, 1); renderList(); }
            });

            // Drag-to-reorder
            card.addEventListener('dragstart', () => { dragSrc = i; card.classList.add('dragging'); });
            card.addEventListener('dragend',   () => { dragSrc = -1; card.classList.remove('dragging'); });
            card.addEventListener('dragover',  e => { e.preventDefault(); card.classList.add('drag-over'); });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', e => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (dragSrc < 0 || dragSrc === i) return;
                const moved = slides.splice(dragSrc, 1)[0];
                slides.splice(i, 0, moved);
                renderList();
            });

            list.appendChild(card);
        });
    }

    function openEdit(i) {
        editIdx = i;
        const s = slides[i];
        container.querySelector('#gal-edit-url').value   = s.imageUrl  || '';
        container.querySelector('#gal-edit-title').value = s.title     || '';
        container.querySelector('#gal-edit-desc').value  = s.description || '';
        container.querySelector('#gal-edit-year').value  = s.year      || '';
        container.querySelector('#gal-edit-alt').value   = s.alt       || '';
        const prev = container.querySelector('#gal-edit-preview');
        prev.src = s.imageUrl || '';
        prev.style.display = s.imageUrl ? 'block' : 'none';
        container.querySelector('#gal-edit-modal').classList.add('open');
    }

    function closeModal() {
        container.querySelector('#gal-edit-modal').classList.remove('open');
        editIdx = -1;
    }

    function clearAddForm() {
        for (const id of ['gal-add-url', 'gal-add-title', 'gal-add-desc', 'gal-add-alt']) {
            container.querySelector('#' + id).value = '';
        }
        container.querySelector('#gal-add-year').value = String(new Date().getFullYear());
        const prev = container.querySelector('#gal-add-preview');
        prev.src = '';
        prev.style.display = 'none';
    }
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
