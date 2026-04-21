/**
 * sections/text.js – Text / Bio section editor
 * Fields: title (section heading), content (HTML via contenteditable)
 */

'use strict';

import { updateSection } from '../db.js';

export function renderTextEditor(container, section, onSaved) {
    const d = section.data || {};

    container.innerHTML = `
<div class="editor-panel active">
    <div class="panel-title"><i class="fas fa-align-left"></i> Text / Bio Section</div>
    <div class="panel-subtitle">Section heading and rich text content</div>

    <div class="field-group">
        <label for="txt-section-title">Section Title</label>
        <input type="text" id="txt-section-title" value="${_esc(section.title || '')}" placeholder="Welcome to my QRZ Page!">
    </div>

    <div class="field-group">
        <label>Content</label>
        <div class="content-toolbar" id="txt-toolbar">
            <button data-cmd="bold"        title="Bold">        <i class="fas fa-bold"></i></button>
            <button data-cmd="italic"      title="Italic">      <i class="fas fa-italic"></i></button>
            <button data-cmd="underline"   title="Underline">   <i class="fas fa-underline"></i></button>
            <button data-cmd="insertUnorderedList" title="List"><i class="fas fa-list-ul"></i></button>
            <button data-cmd="createLink"  title="Link">        <i class="fas fa-link"></i></button>
            <button data-cmd="removeFormat" title="Clear">      <i class="fas fa-remove-format"></i></button>
        </div>
        <div class="content-editable" id="txt-content" contenteditable="true">${d.content || '<p>Write your bio here…</p>'}</div>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-text">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="text-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    const editable = container.querySelector('#txt-content');

    // Toolbar buttons
    container.querySelector('#txt-toolbar').addEventListener('click', e => {
        const btn = e.target.closest('[data-cmd]');
        if (!btn) return;
        const cmd = btn.dataset.cmd;
        if (cmd === 'createLink') {
            const url = prompt('Enter URL:', 'https://');
            if (url) document.execCommand('createLink', false, url);
        } else {
            document.execCommand(cmd, false, null);
        }
        editable.focus();
    });

    // Highlight active format buttons on selection change
    editable.addEventListener('keyup', () => _updateToolbar(container));
    editable.addEventListener('mouseup', () => _updateToolbar(container));

    // Save
    container.querySelector('#btn-save-text').addEventListener('click', () => {
        const title   = container.querySelector('#txt-section-title').value.trim();
        const content = editable.innerHTML.trim();
        const data    = { content };
        updateSection(section.id, title || section.title, data, section.visible);
        _feedback(container, '#text-feedback');
        if (onSaved) onSaved();
    });
}

function _updateToolbar(container) {
    const cmds = ['bold', 'italic', 'underline'];
    for (const cmd of cmds) {
        const btn = container.querySelector(`[data-cmd="${cmd}"]`);
        if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    }
}

function _feedback(container, selector) {
    const el = container.querySelector(selector);
    if (!el) return;
    el.textContent = 'Saved!';
    setTimeout(() => { el.textContent = ''; }, 2000);
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
