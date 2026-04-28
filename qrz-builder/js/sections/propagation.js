/**
 * sections/propagation.js – Embedded image widget editor
 * data: { img_url, img2_url, credit_text, credit_url, icon_class, icon_color }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderPropagationEditor(container, section, onSaved) {
    const d = section.data || {};

    container.innerHTML = `
<div class="editor-panel active">
    <div class="panel-title"><i class="fas fa-image"></i> Embedded Img</div>
    <div class="panel-subtitle">Display one or two linked images with an optional credit line</div>

    <div class="field-group">
        <label for="prop-sec-title">Section Title</label>
        <input type="text" id="prop-sec-title" value="${_esc(section.title || 'Embedded Img')}" placeholder="Embedded Img">
    </div>

    <div class="field-group" style="display:flex;align-items:flex-end;">
        <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:normal;font-weight:600;color:var(--text);cursor:pointer;margin:0;">
            <input type="checkbox" id="prop-hide-title" ${(d.hide_title ? 'checked' : '')} style="width:auto;">
            Hide title on generated page
        </label>
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="prop-icon-class">Header Icon (Font Awesome class)</label>
            <input type="text" id="prop-icon-class" value="${_esc(d.icon_class || 'fas fa-image')}" placeholder="fas fa-image">
            <small style="color:var(--text-muted);margin-top:6px;display:block;">
                Find icon classes at <a href="https://fontawesome.com/search" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;">Font Awesome Search</a>
            </small>
        </div>
        <div class="field-group">
            <label for="prop-icon-color">Header Icon Color</label>
            <input type="color" id="prop-icon-color" value="${_esc(d.icon_color || '#be954e')}">
        </div>
    </div>

    <div class="field-group">
        <label for="prop-img-url">Image URL <span style="color:var(--text-muted);font-weight:400;text-transform:none;">(primary)</span></label>
        <input type="url" id="prop-img-url"
               value="${_esc(d.img_url ?? '')}"
               placeholder="https://www.hamqsl.com/solar101vhf.php">
    </div>

    <div class="field-group">
        <label for="prop-img2-url">Second Image URL <span style="color:var(--text-muted);font-weight:400;text-transform:none;">(optional — e.g. solar map)</span></label>
        <input type="url" id="prop-img2-url"
               value="${_esc(d.img2_url ?? '')}"
               placeholder="https://www.hamqsl.com/solarmap.php">
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="prop-credit-text">Credit Text</label>
            <input type="text" id="prop-credit-text"
                   value="${_esc(d.credit_text ?? '')}"
                   placeholder="HF Propagation by N0NBH">
        </div>
        <div class="field-group">
            <label for="prop-credit-url">Credit Link URL</label>
            <input type="url" id="prop-credit-url"
                   value="${_esc(d.credit_url ?? '')}"
                   placeholder="https://www.hamqsl.com/solar.html">
        </div>
    </div>

    <div class="notice info">
        <i class="fas fa-info-circle" style="margin-top:2px;flex-shrink:0;"></i>
        <span>You can use this for propagation banners, flag counters, badges, or any other embedded image block.</span>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-prop">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="prop-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    container.querySelector('#btn-save-prop').addEventListener('click', () => {
        const data = {
            img_url:     container.querySelector('#prop-img-url').value.trim(),
            img2_url:    container.querySelector('#prop-img2-url').value.trim(),
            icon_class:  container.querySelector('#prop-icon-class').value.trim() || 'fas fa-image',
            icon_color:  container.querySelector('#prop-icon-color').value.trim() || '#be954e',
            credit_text: container.querySelector('#prop-credit-text').value.trim(),
            credit_url:  container.querySelector('#prop-credit-url').value.trim(),
            hide_title:  container.querySelector('#prop-hide-title').checked,
        };
        const newTitle = container.querySelector('#prop-sec-title').value.trim() || 'Embedded Img';
        updateSection(section.id, newTitle, data, section.visible);
        const fb = container.querySelector('#prop-feedback');
        fb.textContent = 'Saved!';
        setTimeout(() => { fb.textContent = ''; }, 2000);
        if (onSaved) onSaved();
    });
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
