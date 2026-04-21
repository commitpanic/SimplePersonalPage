/**
 * sections/map.js – Ham Map section editor
 * data: { iframe_src, title }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderMapEditor(container, section, onSaved) {
    const d = section.data || {};

    container.innerHTML = `
<div class="editor-panel active">
    <div class="panel-title"><i class="fas fa-map-marked-alt"></i> Ham Map Section</div>
    <div class="panel-subtitle">Embed an iframe map (e.g. ham-map-qrz.html)</div>

    <div class="field-group">
        <label for="map-sec-title">Section Title</label>
        <input type="text" id="map-sec-title" value="${_esc(section.title || '')}" placeholder="Ham Map">
    </div>

    <div class="field-group">
        <label for="map-iframe-src">Map iframe URL <span style="color:#ef4444;">*</span></label>
        <input type="url" id="map-iframe-src"
               value="${_esc(d.iframe_src || '')}"
               placeholder="https://commitpanic.github.io/SimplePersonalPage/ham-map-qrz.html">
    </div>

    <div class="field-group">
        <label for="map-iframe-title">iframe title (accessibility)</label>
        <input type="text" id="map-iframe-title"
               value="${_esc(d.iframe_title || '')}"
               placeholder="SP3FCK Ham Map">
    </div>

    <div class="field-group">
        <label for="map-height">Map Height (px)</label>
        <input type="number" id="map-height"
               value="${d.height || 1125}"
               min="300" max="3000" step="50"
               placeholder="1125">
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-map">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="map-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    container.querySelector('#btn-save-map').addEventListener('click', () => {
        const title = container.querySelector('#map-sec-title').value.trim();
        const data  = {
            iframe_src:   container.querySelector('#map-iframe-src').value.trim(),
            iframe_title: container.querySelector('#map-iframe-title').value.trim(),
            height:       parseInt(container.querySelector('#map-height').value, 10) || 1125,
        };
        updateSection(section.id, title || section.title, data, section.visible);
        const fb = container.querySelector('#map-feedback');
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
