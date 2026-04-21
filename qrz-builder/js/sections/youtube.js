/**
 * sections/youtube.js – YouTube Gallery section editor
 * Ported from youtube-manager.html logic.
 * data: { slides: [ { url, title, description, year } ] }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderYouTubeEditor(container, section, onSaved) {
    const d     = section.data || {};
    let slides  = (d.slides || []).map(s => ({ ...s }));
    let editIdx = -1;
    let dragSrc = -1;

    container.innerHTML = `
<div class="editor-panel active" style="max-width:900px;">
    <div class="panel-title"><i class="fab fa-youtube" style="color:#ff0000;"></i> YouTube Gallery</div>
    <div class="panel-subtitle">Manage YouTube video slides shown in the CSS-only carousel</div>

    <div class="items-grid" id="yt-list"></div>

    <!-- Add form -->
    <div class="add-item-form">
        <h4><i class="fas fa-plus-circle" style="color:var(--accent);"></i> Add New Slide</h4>
        <img id="yt-add-preview" class="preview-img-small" alt="Preview">
        <div class="field-group">
            <label>YouTube URL <span style="color:#ef4444;">*</span></label>
            <div class="url-row">
                <input type="url" id="yt-add-url" placeholder="https://youtube.com/shorts/… or youtu.be/…" oninput="window._ytAddInput()">
                <button class="btn btn-secondary btn-icon" onclick="window._ytDetectAdd()" title="Detect video"><i class="fas fa-search"></i></button>
            </div>
        </div>
        <div class="field-row">
            <div class="field-group">
                <label>Title <span style="color:#ef4444;">*</span></label>
                <input type="text" id="yt-add-title" placeholder="Video title">
            </div>
            <div class="field-group">
                <label>Year</label>
                <input type="text" id="yt-add-year" value="${new Date().getFullYear()}" placeholder="${new Date().getFullYear()}">
            </div>
        </div>
        <div class="field-group">
            <label>Description</label>
            <input type="text" id="yt-add-desc" placeholder="Short description">
        </div>
        <button class="btn btn-primary" id="yt-btn-add"><i class="fas fa-plus"></i> Add Slide</button>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-yt">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="yt-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>

<!-- Edit Modal -->
<div class="modal-overlay" id="yt-edit-modal" onclick="if(event.target===this)window._ytCloseModal()">
    <div class="modal-card">
        <h2><i class="fab fa-youtube" style="color:#ff0000;"></i> Edit Slide</h2>
        <img id="yt-edit-preview" class="preview-img-small" alt="Preview" style="display:block;height:120px;">
        <div class="field-group">
            <label>YouTube URL <span style="color:#ef4444;">*</span></label>
            <div class="url-row">
                <input type="url" id="yt-edit-url" placeholder="https://youtube.com/…" oninput="window._ytEditInput()">
                <button class="btn btn-secondary btn-icon" onclick="window._ytDetectEdit()"><i class="fas fa-search"></i></button>
            </div>
        </div>
        <div class="field-row">
            <div class="field-group">
                <label>Title <span style="color:#ef4444;">*</span></label>
                <input type="text" id="yt-edit-title">
            </div>
            <div class="field-group">
                <label>Year</label>
                <input type="text" id="yt-edit-year">
            </div>
        </div>
        <div class="field-group">
            <label>Description</label>
            <input type="text" id="yt-edit-desc">
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="window._ytCloseModal()">Cancel</button>
            <button class="btn btn-primary" id="yt-btn-save-edit"><i class="fas fa-save"></i> Save</button>
        </div>
    </div>
</div>`;

    renderList();

    // ── Globals for inline event handlers ────────────────
    window._ytAddInput  = () => _showThumb(container.querySelector('#yt-add-url').value, container.querySelector('#yt-add-preview'));
    window._ytEditInput = () => _showThumb(container.querySelector('#yt-edit-url').value, container.querySelector('#yt-edit-preview'));
    window._ytDetectAdd = () => {
        const url = container.querySelector('#yt-add-url').value.trim();
        if (!url) return;
        _showThumb(url, container.querySelector('#yt-add-preview'));
    };
    window._ytDetectEdit = () => {
        const url = container.querySelector('#yt-edit-url').value.trim();
        if (!url) return;
        _showThumb(url, container.querySelector('#yt-edit-preview'));
    };
    window._ytCloseModal = closeModal;

    // ── Add slide ─────────────────────────────────────────
    container.querySelector('#yt-btn-add').addEventListener('click', () => {
        const url   = container.querySelector('#yt-add-url').value.trim();
        const title = container.querySelector('#yt-add-title').value.trim();
        if (!url)                           { alert('URL is required.'); return; }
        if (!extractVideoId(url))           { alert('Cannot extract video ID from that URL.'); return; }
        if (!title)                         { alert('Title is required.'); return; }

        slides.push({
            url,
            title,
            description: container.querySelector('#yt-add-desc').value.trim(),
            year:        container.querySelector('#yt-add-year').value.trim() || String(new Date().getFullYear()),
        });
        clearAddForm();
        renderList();
    });

    // ── Edit modal save ───────────────────────────────────
    container.querySelector('#yt-btn-save-edit').addEventListener('click', () => {
        if (editIdx < 0) return;
        const url   = container.querySelector('#yt-edit-url').value.trim();
        const title = container.querySelector('#yt-edit-title').value.trim();
        if (!url || !extractVideoId(url)) { alert('Valid YouTube URL required.'); return; }
        if (!title)                       { alert('Title is required.'); return; }
        slides[editIdx] = {
            url,
            title,
            description: container.querySelector('#yt-edit-desc').value.trim(),
            year:        container.querySelector('#yt-edit-year').value.trim() || String(new Date().getFullYear()),
        };
        closeModal();
        renderList();
    });

    // ── Save ──────────────────────────────────────────────
    container.querySelector('#btn-save-yt').addEventListener('click', () => {
        updateSection(section.id, section.title, { slides }, section.visible);
        const fb = container.querySelector('#yt-feedback');
        fb.textContent = `Saved! (${slides.length} slides)`;
        setTimeout(() => { fb.textContent = ''; }, 2000);
        if (onSaved) onSaved();
    });

    // ── Helpers ───────────────────────────────────────────
    function renderList() {
        const list = container.querySelector('#yt-list');
        list.innerHTML = '';
        if (!slides.length) {
            list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px 0;">No slides yet.</div>';
            return;
        }
        slides.forEach((s, i) => {
            const vid  = extractVideoId(s.url) || '';
            const thumb = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : '';
            const card = document.createElement('div');
            card.className = 'item-card';
            card.draggable = true;
            card.innerHTML = `
                <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
                <img class="item-thumb" src="${_esc(thumb)}" alt="${_esc(s.title)}" onerror="this.src=''">
                <div class="item-info">
                    <div class="item-pos">#${i + 1}</div>
                    <div class="item-title">${_esc(s.title)}</div>
                    <div class="item-desc">${_esc(s.description || '')}</div>
                    <div class="item-url">${vid ? 'ID: ' + vid : _esc(s.url || '')}</div>
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
        container.querySelector('#yt-edit-url').value   = s.url   || '';
        container.querySelector('#yt-edit-title').value = s.title || '';
        container.querySelector('#yt-edit-desc').value  = s.description || '';
        container.querySelector('#yt-edit-year').value  = s.year  || '';
        const vid = extractVideoId(s.url || '');
        const prev = container.querySelector('#yt-edit-preview');
        if (vid) { prev.src = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`; prev.style.display = 'block'; }
        else     { prev.style.display = 'none'; }
        container.querySelector('#yt-edit-modal').classList.add('open');
    }

    function closeModal() {
        container.querySelector('#yt-edit-modal').classList.remove('open');
        editIdx = -1;
    }

    function clearAddForm() {
        for (const id of ['yt-add-url', 'yt-add-title', 'yt-add-desc']) {
            container.querySelector('#' + id).value = '';
        }
        container.querySelector('#yt-add-year').value = String(new Date().getFullYear());
        const prev = container.querySelector('#yt-add-preview');
        prev.src = ''; prev.style.display = 'none';
    }
}

// ── Utils ──────────────────────────────────────────────────────────────────────
export function extractVideoId(url) {
    if (!url) return null;
    const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

function _showThumb(url, imgEl) {
    const vid = extractVideoId(url);
    if (vid) {
        imgEl.src = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
        imgEl.style.display = 'block';
    }
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
