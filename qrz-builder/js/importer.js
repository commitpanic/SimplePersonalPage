/**
 * importer.js – Parse existing qrz_bio.html → project sections in DB
 *
 * Fast path: reads GAL-DATA: and YT-DATA: JSON comments
 * Fallback:  DOMParser for header / station / map / propagation
 */

'use strict';

import { replaceSections, replaceTheme, getSections } from './db.js';

const GAL_DATA_RE = /<!-- GAL-DATA:([\s\S]*?) -->/;
const YT_DATA_RE  = /<!-- YT-DATA:([\s\S]*?) -->/;

/**
 * Parse qrz_bio.html and write sections + theme into the project.
 * Returns the number of sections imported.
 */
export function importFromHtml(htmlText, projectId) {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(htmlText, 'text/html');

    const sections = [];

    // 1. Header ─────────────────────────────────────────────────────────────
    const headerEl = doc.querySelector('.header');
    if (headerEl) {
        const callsign  = headerEl.querySelector('.callsign')?.textContent.trim() || '';
        const locEl     = headerEl.querySelector('.location');
        const location  = locEl  ? _textContent(locEl, ['.location a', '.location span']) : '';
        const mapsLinkEl = locEl  ? locEl.querySelector('a[href*="maps.google"], a[href*="google.com/maps"]') : null;
        const maps_url  = mapsLinkEl ? mapsLinkEl.href : (location ? 'https://maps.google.com/?q=' + encodeURIComponent(location) : '');
        const emailEl   = headerEl.querySelector('[href^="mailto:"]');
        const email     = emailEl ? emailEl.href.replace('mailto:', '') : '';
        const logoEl    = headerEl.querySelector('img');
        const logo_url  = logoEl  ? logoEl.getAttribute('src') || '' : '';
        const iconEl    = headerEl.querySelector('.radio-icon i');
        const icon_class = iconEl ? iconEl.className : 'fas fa-broadcast-tower';
        // Parse animation from CSS – check if @keyframes pulse/glow etc in style
        let icon_animation = 'pulse';
        // Extract links
        const links = [];
        headerEl.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
            const label = a.textContent.trim();
            const iconEl2 = a.querySelector('i');
            if (label) links.push({ icon: iconEl2 ? iconEl2.className : 'fas fa-link', label, url: href });
        });

        sections.push({
            type:  'header',
            title: 'Header',
            data:  { callsign, location, maps_url, email, logo_url, icon_class, icon_animation, links },
        });
    }

    // 2. Text / Bio ──────────────────────────────────────────────────────────
    const welcomeEl = doc.querySelector('.welcome-section, .welcome-section2');
    if (welcomeEl) {
        const heading = welcomeEl.querySelector('h2')?.textContent.trim() || 'Welcome';
        const bioEl   = welcomeEl.querySelector('.bio-text, .special-text');
        const content = bioEl ? bioEl.innerHTML.trim() : welcomeEl.innerHTML;
        sections.push({
            type:  'text',
            title: heading,
            data:  { content },
        });
    }

    // 3. Station Info ────────────────────────────────────────────────────────
    const stationEl = doc.querySelector('.station-section');
    if (stationEl) {
        const items = [];
        stationEl.querySelectorAll('.station-item').forEach(item => {
            const key   = item.querySelector('h3')?.textContent.trim() || '';
            const value = item.querySelector('p')?.textContent.trim()  || '';
            if (key) items.push({ key, value });
        });
        sections.push({
            type:  'station',
            title: 'Station Information',
            data:  { items },
        });
    }

    // 4. Ham Map ─────────────────────────────────────────────────────────────
    const mapEl = doc.querySelector('.map-section');
    if (mapEl) {
        const iframeEl    = mapEl.querySelector('iframe');
        const iframe_src  = iframeEl?.getAttribute('src')   || '';
        const iframe_title = iframeEl?.getAttribute('title') || '';
        const heightAttr  = iframeEl?.style?.height || iframeEl?.getAttribute('height') || '';
        const height      = parseInt(heightAttr, 10) || 1125;
        sections.push({
            type:  'map',
            title: 'Ham Map',
            data:  { iframe_src, iframe_title, height },
        });
    }

    // 5. YouTube Gallery ─────────────────────────────────────────────────────
    const ytDataMatch = htmlText.match(YT_DATA_RE);
    const ytSlides    = ytDataMatch ? _parseJson(ytDataMatch[1], []) : _parseYtFromDom(doc);
    if (ytSlides.length > 0 || doc.querySelector('.youtube-section')) {
        sections.push({
            type:  'youtube',
            title: 'YouTube Videos',
            data:  { slides: ytSlides },
        });
    }

    // 6. Awards Gallery ──────────────────────────────────────────────────────
    const galDataMatch = htmlText.match(GAL_DATA_RE);
    const galSlides    = galDataMatch ? _parseJson(galDataMatch[1], []) : _parseGalFromDom(doc);
    if (galSlides.length > 0 || doc.querySelector('.awards-section')) {
        sections.push({
            type:  'gallery',
            title: 'Ham Radio Awards Gallery',
            data:  { slides: galSlides },
        });
    }

    // 7. Propagation ─────────────────────────────────────────────────────────
    const propEl = doc.querySelector('.propagation-section, .propagation-widget');
    if (propEl) {
        const imgEl      = propEl.querySelector('.propagation-img, img');
        const creditEl   = propEl.querySelector('.propagation-credit');
        const creditLink = creditEl?.querySelector('a');
        sections.push({
            type:  'propagation',
            title: 'HF Propagation',
            data:  {
                img_url:     imgEl?.getAttribute('src') || 'https://www.hamqsl.com/solar101vhf.php',
                credit_text: creditEl?.textContent.trim() || 'HF Propagation by N0NBH',
                credit_url:  creditLink?.href || 'https://www.hamqsl.com/solar.html',
            },
        });
    }

    // Write to DB
    replaceSections(projectId, sections);
    return sections.length;
}

// ── DOM parse helpers ──────────────────────────────────────────────────────────

function _parseYtFromDom(doc) {
    const slides = [];
    const navSets = doc.querySelectorAll('.youtube-nav-set');
    const orderMap = {};
    navSets.forEach(nav => {
        const m = nav.className.match(/ytnav-(\w+)/);
        const counter = nav.querySelector('.youtube-slide-counter');
        if (m && counter) {
            const pos = parseInt(counter.textContent.split('/')[0].trim(), 10) - 1;
            orderMap[pos] = m[1];
        }
    });
    for (let i = 0; i < navSets.length; i++) {
        const id = orderMap[i];
        if (id === undefined) continue;
        const slideDiv = doc.querySelector(`.youtube-slide${id}, .youtube-slide-${id}`);
        if (!slideDiv) continue;
        const linkEl  = slideDiv.querySelector('a.youtube-thumbnail-container');
        const titleEl = slideDiv.querySelector('.youtube-info h3');
        const descEl  = slideDiv.querySelector('.youtube-info p');
        const yearEl  = slideDiv.querySelector('.youtube-date');
        if (titleEl) {
            slides.push({
                url:         linkEl?.getAttribute('href')   || '',
                title:       titleEl.textContent.trim(),
                description: descEl?.textContent.trim()     || '',
                year:        yearEl?.textContent.trim()     || '2026',
            });
        }
    }
    return slides;
}

function _parseGalFromDom(doc) {
    const slides = [];
    const navSets = doc.querySelectorAll('.gallery-nav-set');
    const orderMap = {};
    navSets.forEach(nav => {
        const m = nav.className.match(/gnav-(\d+)|nav-(\d+)/);
        const counter = nav.querySelector('.slide-counter');
        if (m && counter) {
            const pos = parseInt(counter.textContent.split('/')[0].trim(), 10) - 1;
            const id  = m[1] || m[2];
            orderMap[pos] = id;
        }
    });
    for (let i = 0; i < navSets.length; i++) {
        const id = orderMap[i];
        if (id === undefined) continue;
        const slideDiv = doc.querySelector(`.gslide-${id}, .slide${id}`);
        if (!slideDiv) continue;
        const imgEl   = slideDiv.querySelector('img');
        const titleEl = slideDiv.querySelector('.award-info h3');
        const descEl  = slideDiv.querySelector('.award-info p');
        const yearEl  = slideDiv.querySelector('.award-date');
        slides.push({
            imageUrl:    imgEl?.getAttribute('src')                                || '',
            alt:         imgEl?.getAttribute('alt')                                || '',
            title:       titleEl?.textContent.trim()                               || '',
            description: descEl?.textContent.trim()                                || '',
            year:        yearEl?.textContent.replace(/Year:\s*/i, '').trim()       || '2025',
        });
    }
    return slides;
}

function _textContent(parent, selectors) {
    for (const sel of selectors) {
        const el = parent.querySelector(sel);
        if (el) return el.textContent.trim();
    }
    return parent.textContent.trim();
}

function _parseJson(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
}
