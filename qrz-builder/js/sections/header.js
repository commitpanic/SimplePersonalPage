/**
 * sections/header.js – Header section editor
 * Fields: callsign, location, email, logo_url, icon_class, icon_animation,
 *         links[] { label, url, icon }
 */

'use strict';

import { updateSection } from '../db.js';

const ICON_ANIMATIONS = ['pulse', 'glow', 'bounce', 'rotate', 'none'];

const ICON_SUGGESTIONS = [
    { cls: 'fas fa-broadcast-tower', label: 'Broadcast Tower' },
    { cls: 'fa-solid fa-meteor',      label: 'Meteor' },
    { cls: 'fas fa-satellite-dish',  label: 'Satellite Dish' },
    { cls: 'fas fa-signal',          label: 'Signal' },
    { cls: 'fas fa-wifi',            label: 'WiFi' },
    { cls: 'fa-solid fa-podcast',    label: 'Podcast' },
];

export function renderHeaderEditor(container, section, onSaved) {
    const d = section.data || {};
    const links = d.links || [];

    container.innerHTML = `
<div class="editor-panel active">
    <div class="panel-title"><i class="fas fa-heading"></i> Header Section</div>
    <div class="panel-subtitle">Callsign, location, logo and icon displayed at the top of your page</div>

    <div class="field-row">
        <div class="field-group">
            <label for="h-callsign">Callsign</label>
            <input type="text" id="h-callsign" value="${_esc(d.callsign || '')}" placeholder="SP3FCK">
        </div>
        <div class="field-group">
            <label for="h-location">Location</label>
            <input type="text" id="h-location" value="${_esc(d.location || '')}" placeholder="Poland, Świebodzin">
        </div>
    </div>

    <div class="field-group">
        <label for="h-maps-url">Google Maps URL
            <span style="color:var(--text-muted);font-weight:400;text-transform:none;"> — leave empty to auto-generate from Location</span>
        </label>
        <div style="display:flex;gap:8px;">
            <input type="url" id="h-maps-url" value="${_esc(d.maps_url || '')}" placeholder="https://maps.google.com/?q=…" style="flex:1;">
            <button class="btn btn-secondary btn-sm" id="btn-gen-maps" title="Generate from Location">
                <i class="fas fa-map-marker-alt"></i> Generate
            </button>
        </div>
        <small style="color:var(--text-muted);margin-top:4px;display:block;">The location text on your page will be a clickable link to this map.</small>
    </div>

    <div class="field-group">
        <label for="h-email">Email</label>
        <input type="email" id="h-email" value="${_esc(d.email || '')}" placeholder="callsign@gmail.com">
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="h-logo-url">Logo Image URL <span style="color:#777;font-weight:400;text-transform:none;">(optional)</span></label>
            <input type="url" id="h-logo-url" value="${_esc(d.logo_url || '')}" placeholder="https://static.qrz.com/k/…/logo.png">
        </div>
    </div>

    <div class="field-row">
        <div class="field-group">
            <label for="h-icon-class">Radio Icon (Font Awesome class)
                <a href="https://fontawesome.com/search" target="_blank" rel="noopener noreferrer"
                   style="font-weight:400;text-transform:none;font-size:0.78rem;margin-left:8px;color:var(--accent);">
                    <i class="fas fa-external-link-alt" style="font-size:0.7rem;"></i> Browse icons
                </a>
            </label>
            <input type="text" id="h-icon-class" value="${_esc(d.icon_class || 'fas fa-broadcast-tower')}" placeholder="fas fa-broadcast-tower">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;" id="icon-suggestions"></div>
        </div>
        <div class="field-group">
            <label for="h-icon-anim">Icon Animation</label>
            <select id="h-icon-anim">
                ${ICON_ANIMATIONS.map(a => `<option value="${a}" ${(d.icon_animation || 'pulse') === a ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
        </div>
    </div>

    <!-- Links -->
    <div class="field-group">
        <label>Navigation Links</label>
        <div class="links-list" id="links-list"></div>
        <button class="btn btn-secondary btn-sm" id="btn-add-link">
            <i class="fas fa-plus"></i> Add Link
        </button>
    </div>

    <div class="panel-save-bar">
        <button class="btn btn-primary" id="btn-save-header">
            <i class="fas fa-save"></i> Save
        </button>
        <span id="header-feedback" style="font-size:0.82rem;color:#4ade80;"></span>
    </div>
</div>`;

    // Google Maps auto-generate
    container.querySelector('#btn-gen-maps').addEventListener('click', () => {
        const loc = container.querySelector('#h-location').value.trim();
        if (!loc) { alert('Fill in the Location field first.'); return; }
        container.querySelector('#h-maps-url').value =
            'https://maps.google.com/?q=' + encodeURIComponent(loc);
    });

    // Auto-update maps URL when location changes (only if maps_url is empty or was auto-generated)
    container.querySelector('#h-location').addEventListener('input', () => {
        const mapsInput = container.querySelector('#h-maps-url');
        const current   = mapsInput.value.trim();
        // Only auto-update if empty or already auto-generated (starts with standard google maps q=)
        if (!current || current.startsWith('https://maps.google.com/?q=')) {
            const loc = container.querySelector('#h-location').value.trim();
            mapsInput.value = loc
                ? 'https://maps.google.com/?q=' + encodeURIComponent(loc)
                : '';
        }
    });

    // Icon suggestions
    const suggestEl = container.querySelector('#icon-suggestions');
    for (const ic of ICON_SUGGESTIONS) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost btn-sm';
        btn.title = ic.label;
        btn.innerHTML = `<i class="${ic.cls}"></i>`;
        btn.addEventListener('click', () => {
            container.querySelector('#h-icon-class').value = ic.cls;
        });
        suggestEl.appendChild(btn);
    }

    // Links list
    let linksData = links.map(l => ({ ...l }));
    _renderLinks(container, linksData);

    container.querySelector('#btn-add-link').addEventListener('click', () => {
        linksData.push({ icon: 'fas fa-link', icon_color: '', label: '', url: '' });
        _renderLinks(container, linksData);
    });

    // Save
    container.querySelector('#btn-save-header').addEventListener('click', () => {
        const loc = container.querySelector('#h-location').value.trim();
        let mapsUrl = container.querySelector('#h-maps-url').value.trim();
        // Auto-generate if field is empty
        if (!mapsUrl && loc) {
            mapsUrl = 'https://maps.google.com/?q=' + encodeURIComponent(loc);
        }
        const data = {
            callsign:       container.querySelector('#h-callsign').value.trim(),
            location:       loc,
            maps_url:       mapsUrl,
            email:          container.querySelector('#h-email').value.trim(),
            logo_url:       container.querySelector('#h-logo-url').value.trim(),
            icon_class:     container.querySelector('#h-icon-class').value.trim() || 'fas fa-broadcast-tower',
            icon_animation: container.querySelector('#h-icon-anim').value,
            links:          _collectLinks(container),
        };
        updateSection(section.id, section.title, data, section.visible);
        _feedback(container, '#header-feedback');
        if (onSaved) onSaved();
    });
}

function _renderLinks(container, linksData) {
    const list = container.querySelector('#links-list');
    list.innerHTML = '';
    linksData.forEach((link, i) => {
        const row = document.createElement('div');
        row.className = 'link-row';
        row.innerHTML = `
            <input type="text"  data-i="${i}" data-f="icon"       placeholder="fas fa-link"  value="${_esc(link.icon  || '')}" style="flex:1.2;" title="Font Awesome class, e.g. fas fa-link">
            <input type="color" data-i="${i}" data-f="icon_color" value="${link.icon_color || '#6a92e9'}" title="Icon colour" style="width:36px;height:36px;padding:2px;border-radius:6px;cursor:pointer;flex:none;">
            <input type="text"  data-i="${i}" data-f="label"      placeholder="Label"        value="${_esc(link.label || '')}" style="flex:1.5;">
            <input type="url"   data-i="${i}" data-f="url"        placeholder="https://…"   value="${_esc(link.url   || '')}" style="flex:2;">
            <button class="btn btn-danger btn-icon btn-sm" data-rm="${i}" title="Remove"><i class="fas fa-trash"></i></button>`;
        row.querySelector(`[data-rm="${i}"]`).addEventListener('click', () => {
            linksData.splice(i, 1);
            _renderLinks(container, linksData);
        });
        for (const input of row.querySelectorAll('input')) {
            input.addEventListener('input', () => {
                linksData[parseInt(input.dataset.i)][input.dataset.f] = input.value;
            });
            input.addEventListener('change', () => {
                linksData[parseInt(input.dataset.i)][input.dataset.f] = input.value;
            });
        }
        list.appendChild(row);
    });
}

function _collectLinks(container) {
    const rows = container.querySelectorAll('.link-row');
    return Array.from(rows).map(row => ({
        icon:       row.querySelector('[data-f="icon"]')?.value.trim()       || '',
        icon_color: row.querySelector('[data-f="icon_color"]')?.value        || '',
        label:      row.querySelector('[data-f="label"]')?.value.trim()      || '',
        url:        row.querySelector('[data-f="url"]')?.value.trim()        || '',
    })).filter(l => l.label || l.url);
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
