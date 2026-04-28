/**
 * sections/links.js – Quick Links section editor
 * data: { icon_class, icon_color, links: [ { label, url, btn_color } ] }
 */

'use strict';

import { updateSection } from '../db.js';

function _esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderLinksEditor(container, section, onSaved) {
    const d = section.data || {};
    let links = (d.links || []).map(l => ({ ...l }));

    container.innerHTML = `
<div class="editor-panel active" style="max-width:700px;">
    <div class="panel-title"><i class="fas fa-link"></i> Quick Links</div>
    <div class="panel-subtitle">Add important links displayed as full-width buttons</div>

    <div class="field-group">
        <label for="links-section-title">Section Title</label>
        <input type="text" id="links-section-title" value="${_esc(section.title || 'Quick Links')}" placeholder="e.g. Important Links, My Activities…">
    </div>

    <div class="field-group" style="display:flex;align-items:flex-end;">
        <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:normal;font-weight:600;color:var(--text);cursor:pointer;margin:0;">
            <input type="checkbox" id="links-hide-title" ${(d.hide_title ? 'checked' : '')} style="width:auto;">
            Hide title on generated page
        </label>
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="links-icon-class">Header Icon (Font Awesome class)</label>
            <input type="text" id="links-icon-class" value="${_esc(d.icon_class || 'fas fa-link')}" placeholder="fas fa-link">
            <small style="color:var(--text-muted);margin-top:6px;display:block;">
                Find icon classes at <a href="https://fontawesome.com/search" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;">Font Awesome Search</a>
            </small>
        </div>
        <div class="field-group">
            <label for="links-icon-color">Header Icon Color</label>
            <input type="color" id="links-icon-color" value="${_esc(d.icon_color || '#be954e')}">
        </div>
    </div>

    <div id="links-list" class="items-grid"></div>

    <div class="add-item-form">
        <h4><i class="fas fa-plus-circle" style="color:var(--accent);"></i> Add New Link</h4>
        <div class="field-group">
            <label>Button Label <span style="color:#ef4444;">*</span></label>
            <input type="text" id="link-add-label" placeholder="e.g. Diploma Action SP-25">
        </div>
        <div class="field-group">
            <label>URL <span style="color:#ef4444;">*</span></label>
            <input type="url" id="link-add-url" placeholder="https://…">
        </div>
        <div class="field-row">
            <div class="field-group">
                <label>Button Color</label>
                <input type="color" id="link-add-color" value="#2563eb">
            </div>
            <div class="field-group" style="display:flex;align-items:flex-end;">
                <button class="btn btn-primary" id="link-btn-add" style="width:100%;"><i class="fas fa-plus"></i> Add Link</button>
            </div>
        </div>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-links">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="links-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    renderList();

    container.querySelector('#link-btn-add').addEventListener('click', () => {
        const label = container.querySelector('#link-add-label').value.trim();
        const url   = container.querySelector('#link-add-url').value.trim();
        if (!label) { alert('Button label is required.'); return; }
        if (!url)   { alert('URL is required.'); return; }
        links.push({
            label,
            url,
            btn_color: container.querySelector('#link-add-color').value || '#2563eb',
        });
        container.querySelector('#link-add-label').value = '';
        container.querySelector('#link-add-url').value   = '';
        renderList();
    });

    container.querySelector('#btn-save-links').addEventListener('click', () => {
        const newTitle = container.querySelector('#links-section-title').value.trim() || 'Quick Links';
        updateSection(section.id, newTitle, {
            icon_class: container.querySelector('#links-icon-class').value.trim() || 'fas fa-link',
            icon_color: container.querySelector('#links-icon-color').value.trim() || '#be954e',
            hide_title: container.querySelector('#links-hide-title').checked,
            links,
        }, section.visible);
        const fb = container.querySelector('#links-feedback');
        fb.textContent = `Saved! (${links.length} links)`;
        setTimeout(() => { fb.textContent = ''; }, 2000);
        if (onSaved) onSaved();
    });

    function renderList() {
        const list = container.querySelector('#links-list');
        list.innerHTML = '';
        if (!links.length) {
            list.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:12px 0;">No links yet. Add one below.</div>`;
            return;
        }
        links.forEach((lnk, idx) => {
            const row = document.createElement('div');
            row.className = 'item-card';
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card-bg,#1c1c21);border-radius:8px;margin-bottom:6px;';
            row.innerHTML = `
                <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${_esc(lnk.btn_color)};flex-shrink:0;"></span>
                <span style="flex:1;font-size:0.9rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                    <strong>${_esc(lnk.label)}</strong>
                    <span style="color:var(--text-muted);font-size:0.78rem;margin-left:6px;">${_esc(lnk.url)}</span>
                </span>
                <button class="btn btn-secondary btn-icon btn-sm" data-edit="${idx}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="btn btn-danger btn-icon btn-sm" data-del="${idx}" title="Delete"><i class="fas fa-trash"></i></button>`;

            row.querySelector('[data-del]').addEventListener('click', () => {
                links.splice(idx, 1);
                renderList();
            });

            row.querySelector('[data-edit]').addEventListener('click', () => {
                const newLabel = prompt('Button label:', lnk.label);
                if (newLabel === null) return;
                const newUrl = prompt('URL:', lnk.url);
                if (newUrl === null) return;
                const newColor = prompt('Button color (hex):', lnk.btn_color);
                if (newColor !== null) links[idx].btn_color = newColor.trim() || lnk.btn_color;
                if (newLabel.trim()) links[idx].label = newLabel.trim();
                if (newUrl.trim())   links[idx].url   = newUrl.trim();
                renderList();
            });

            list.appendChild(row);
        });
    }
}
