/**
 * sections/iframe.js – Generic iframe embed editor
 * data: { src, title, width, height }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderIframeEditor(container, section, onSaved) {
    const d = section.data || {};

    container.innerHTML = `
<div class="editor-panel active">
    <div class="panel-title"><i class="fas fa-puzzle-piece"></i> Embedded Gadget</div>
    <div class="panel-subtitle">Embed any iframe: Ham Map, Propagation widget, external tool, etc.</div>

    <div class="field-group">
        <label for="ifr-sec-title">Section Title</label>
        <input type="text" id="ifr-sec-title" value="${_esc(section.title || '')}" placeholder="Embedded Widget">
    </div>

    <div class="field-group">
        <label for="ifr-src">Source URL <span style="color:#ef4444;">*</span></label>
        <input type="url" id="ifr-src" value="${_esc(d.src || '')}" placeholder="https://example.com/widget">
    </div>

    <div class="field-group">
        <label for="ifr-title">iframe title (accessibility)</label>
        <input type="text" id="ifr-title" value="${_esc(d.title || '')}" placeholder="Widget title">
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="ifr-width">Width</label>
            <input type="text" id="ifr-width" value="${_esc(d.width || '100%')}" placeholder="100%">
        </div>
        <div class="field-group">
            <label for="ifr-height">Height</label>
            <input type="text" id="ifr-height" value="${_esc(d.height || '400px')}" placeholder="400px">
        </div>
    </div>

    <div class="notice info">
        <i class="fas fa-info-circle" style="margin-top:2px;flex-shrink:0;"></i>
        <span>QRZ.com may block some external URLs via X-Frame-Options headers. Prefer self-hosted or GitHub Pages content.</span>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-iframe">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="ifr-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    container.querySelector('#btn-save-iframe').addEventListener('click', () => {
        const title = container.querySelector('#ifr-sec-title').value.trim();
        const data  = {
            src:    container.querySelector('#ifr-src').value.trim(),
            title:  container.querySelector('#ifr-title').value.trim(),
            width:  container.querySelector('#ifr-width').value.trim()  || '100%',
            height: container.querySelector('#ifr-height').value.trim() || '400px',
        };
        updateSection(section.id, title || section.title, data, section.visible);
        const fb = container.querySelector('#ifr-feedback');
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
