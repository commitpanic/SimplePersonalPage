/**
 * sections/propagation.js – HF Propagation widget editor
 * data: { img_url, credit_text, credit_url }
 */

'use strict';

import { updateSection } from '../db.js';

export function renderPropagationEditor(container, section, onSaved) {
    const d = section.data || {};

    container.innerHTML = `
<div class="editor-panel active">
    <div class="panel-title"><i class="fas fa-wave-square"></i> HF Propagation Widget</div>
    <div class="panel-subtitle">Display a propagation forecast image with a credit link</div>

    <div class="field-group">
        <label for="prop-sec-title">Section Title</label>
        <input type="text" id="prop-sec-title" value="${_esc(section.title || 'HF Propagation')}" placeholder="HF Propagation">
    </div>

    <div class="field-group">
        <label for="prop-img-url">Propagation Image URL</label>
        <input type="url" id="prop-img-url"
               value="${_esc(d.img_url || 'https://www.hamqsl.com/solar101vhf.php')}"
               placeholder="https://www.hamqsl.com/solar101vhf.php">
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="prop-credit-text">Credit Text</label>
            <input type="text" id="prop-credit-text"
                   value="${_esc(d.credit_text || 'HF Propagation by N0NBH')}"
                   placeholder="HF Propagation by N0NBH">
        </div>
        <div class="field-group">
            <label for="prop-credit-url">Credit Link URL</label>
            <input type="url" id="prop-credit-url"
                   value="${_esc(d.credit_url || 'https://www.hamqsl.com/solar.html')}"
                   placeholder="https://www.hamqsl.com/solar.html">
        </div>
    </div>

    <div class="notice info">
        <i class="fas fa-info-circle" style="margin-top:2px;flex-shrink:0;"></i>
        <span>The default URL uses the N0NBH HF Propagation banner — a widely used widget in the ham radio community.</span>
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
            credit_text: container.querySelector('#prop-credit-text').value.trim(),
            credit_url:  container.querySelector('#prop-credit-url').value.trim(),
        };
        const newTitle = container.querySelector('#prop-sec-title').value.trim() || 'HF Propagation';
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
