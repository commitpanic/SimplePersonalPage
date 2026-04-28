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
const GRIDIMG_DATA_RE = /<!-- GRIDIMG-DATA:([\s\S]*?) -->/;

/**
 * Parse qrz_bio.html and write sections + theme into the project.
 * Returns the number of sections imported.
 */
export function importFromHtml(htmlText, projectId) {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(htmlText, 'text/html');

    // Scope searches to <main class="main-content"> to avoid the QRZ
    // double-render copy that appears at the bottom of uploaded files.
    const root = doc.querySelector('main.main-content') || doc;

    const sections = [];

    // 1. Header ─────────────────────────────────────────────────────────────
    const headerEl = doc.querySelector('.header');
    if (headerEl) {
        const callsign  = headerEl.querySelector('.callsign')?.textContent.trim() || '';
        const locEl     = headerEl.querySelector('.location');
        const location  = locEl  ? _textContent(locEl, ['.location a', '.location span']) : '';
        const mapsLinkEl = locEl  ? locEl.querySelector('a[href*="maps.google"], a[href*="google.com/maps"]') : null;
        const maps_url  = mapsLinkEl ? (mapsLinkEl.getAttribute('href') || '') : (location ? 'https://maps.google.com/?q=' + encodeURIComponent(location) : '');
        // Email: look for mailto: link first, then fall back to span text containing '@'
        const emailEl   = headerEl.querySelector('[href^="mailto:"]');
        let   email     = emailEl ? emailEl.getAttribute('href').replace('mailto:', '') : '';
        if (!email && locEl) {
            locEl.querySelectorAll('span').forEach(span => {
                if (!email && span.textContent.includes('@')) email = span.textContent.trim();
            });
        }
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
            // Skip location/maps links and links containing images (logo)
            if (a.closest('.location') || a.querySelector('img')) return;
            const label = a.textContent.trim();
            if (!label) return;

            // Icon can be inside <a> OR as a preceding sibling <i>
            let iconEl2    = a.querySelector('i');
            let icon_color = '';
            if (!iconEl2) {
                let prev = a.previousSibling;
                while (prev) {
                    if (prev.nodeType === 1 /* Element */) {
                        if (prev.tagName === 'I') iconEl2 = prev;
                        break;
                    }
                    prev = prev.previousSibling;
                }
            }
            if (iconEl2) {
                const cm = (iconEl2.getAttribute('style') || '').match(/color\s*:\s*([^;]+)/);
                icon_color = cm ? cm[1].trim() : '';
            }
            links.push({
                icon:       iconEl2 ? iconEl2.className : 'fas fa-link',
                icon_color,
                label,
                url: href,
            });
        });

        sections.push({
            type:  'header',
            title: 'Header',
            data:  { callsign, location, maps_url, email, logo_url, icon_class, icon_animation, links },
        });
    }

    // Pre-parse YouTube / Gallery data from JSON comments (for fast-path)
    const ytDataMatch  = htmlText.match(YT_DATA_RE);
    const galDataMatch = htmlText.match(GAL_DATA_RE);
    const gridImgDataMatch = htmlText.match(GRIDIMG_DATA_RE);
    const ytSlidesData  = ytDataMatch  ? _parseJson(ytDataMatch[1],  []) : null; // null → parse from DOM
    const galSlidesData = galDataMatch ? _parseJson(galDataMatch[1], []) : null;
    const gridImgData   = gridImgDataMatch ? _parseJson(gridImgDataMatch[1], null) : null;

    // Walk all content sections in document order so the imported list
    // matches the visual order in the original file.
    const ORDER_SELECTOR = [
        '.welcome-section', '.welcome-section2',
        '.station-section',
        '.embed-section',
        '.map-section',
        '.youtube-section',
        '.awards-section',
        '.image-grid-section',
        '.quick-links-section',
        '.propagation-section',
        '.propagation-widget',
    ].join(', ');

    const _orderedEls = Array.from(root.querySelectorAll(ORDER_SELECTOR));
    console.log('[importer] DOM order:', _orderedEls.map(e => e.className.split(' ')[0] + (e.querySelector('h2') ? ':"' + e.querySelector('h2').textContent.trim().slice(0,30) + '"' : '')));

    _orderedEls.forEach(el => {

        // ── Text / Bio ──────────────────────────────────────────────────────
        if (el.matches('.welcome-section, .welcome-section2')) {
            const heading = el.querySelector('h2');
            const hide_title = !heading;
            const bioEl   = el.querySelector('.bio-text, .special-text');
            const content = bioEl ? bioEl.innerHTML.trim() : el.innerHTML;
            sections.push({ 
                type: 'text', 
                title: heading?.textContent?.trim() || 'Welcome', 
                data: { content, hide_title } 
            });

        // ── Station Info ────────────────────────────────────────────────────
        } else if (el.matches('.station-section')) {
            const heading = el.querySelector('h2');
            const items = [];
            el.querySelectorAll('.station-item').forEach(item => {
                const key   = item.querySelector('h3')?.textContent.trim() || '';
                const value = item.querySelector('p')?.textContent.trim()  || '';
                if (key) items.push({ key, value });
            });
            const hide_title = !heading;
            sections.push({ 
                type: 'station', 
                title: heading 
                    ? Array.from(heading.childNodes)
                        .filter(n => n.nodeType === 3)
                        .map(n => n.textContent.trim())
                        .join('').trim() || 'Station Information'
                    : 'Station Information', 
                data: { items, hide_title } 
            });

        // ── Embedded iframe (.embed-section) ───────────────────────────────
        } else if (el.matches('.embed-section')) {
            const iframeEl   = el.querySelector('iframe');
            const titleH2    = el.querySelector('.embed-header h2');
            const iconEl     = titleH2?.querySelector('i');
            const icon_class = iconEl ? iconEl.className : 'fas fa-puzzle-piece';
            const iconStyle  = iconEl?.getAttribute('style') || '';
            const colorMatch = iconStyle.match(/color\s*:\s*([^;]+)/);
            const icon_color = colorMatch ? colorMatch[1].trim() : '#be954e';
            const hide_title = !titleH2;
            const sectionTitle = titleH2
                ? Array.from(titleH2.childNodes)
                    .filter(n => n.nodeType === 3)
                    .map(n => n.textContent.trim())
                    .join('').trim() || section_title_from_iframe(iframeEl)
                : section_title_from_iframe(iframeEl);
            const iframeStyle = iframeEl?.getAttribute('style') || '';
            const heightMatch = iframeStyle.match(/height\s*:\s*([^;]+)/);
            const widthMatch  = iframeStyle.match(/width\s*:\s*([^;]+)/);
            sections.push({
                type:  'iframe',
                title: sectionTitle,
                data:  {
                    src:        iframeEl?.getAttribute('src')   || '',
                    title:      iframeEl?.getAttribute('title') || '',
                    icon_class,
                    icon_color,
                    width:      (widthMatch  ? widthMatch[1].trim()  : null) || '100%',
                    height:     (heightMatch ? heightMatch[1].trim() : null) || '400px',
                    hide_title,
                },
            });


        // ── Legacy Ham Map (.map-section) ───────────────────────────────────
        } else if (el.matches('.map-section')) {
            const heading = el.querySelector('.map-header h2');
            const iconEl = heading?.querySelector('i');
            const iconStyle = iconEl?.getAttribute('style') || '';
            const colorMatch = iconStyle.match(/color\s*:\s*([^;]+)/);
            const iframeEl     = el.querySelector('iframe');
            const iframe_src   = iframeEl?.getAttribute('src')   || '';
            const iframe_title = iframeEl?.getAttribute('title') || '';
            const heightAttr   = iframeEl?.style?.height || iframeEl?.getAttribute('height') || '';
            const height       = parseInt(heightAttr, 10) || 1125;
            const hide_title = !heading;
            sections.push({ 
                type: 'map', 
                title: heading 
                    ? Array.from(heading.childNodes)
                        .filter(n => n.nodeType === 3)
                        .map(n => n.textContent.trim())
                        .join('').trim() || 'Ham Map'
                    : 'Ham Map', 
                data: { iframe_src, iframe_title, height, hide_title } 
            });

        // ── YouTube Gallery ─────────────────────────────────────────────────
        } else if (el.matches('.youtube-section')) {
            const heading = el.querySelector('.youtube-header h2');
            const hide_title = !heading;
            const slides = ytSlidesData !== null ? ytSlidesData : _parseYtFromDom(root);
            sections.push({ 
                type: 'youtube', 
                title: heading 
                    ? Array.from(heading.childNodes)
                        .filter(n => n.nodeType === 3)
                        .map(n => n.textContent.trim())
                        .join('').trim() || 'YouTube Videos'
                    : 'YouTube Videos', 
                data: { slides, hide_title } 
            });

        // ── Awards Gallery ──────────────────────────────────────────────────
        } else if (el.matches('.awards-section')) {
            const heading = el.querySelector('.awards-header h2');
            const iconEl = heading?.querySelector('i');
            const iconStyle = iconEl?.getAttribute('style') || '';
            const colorMatch = iconStyle.match(/color\s*:\s*([^;]+)/);
            const hide_title = !heading;
            const slides = galSlidesData !== null ? galSlidesData : _parseGalFromDom(root);
            sections.push({ 
                type: 'gallery', 
                title: heading 
                    ? Array.from(heading.childNodes)
                        .filter(n => n.nodeType === 3)
                        .map(n => n.textContent.trim())
                        .join('').trim() || 'Ham Radio Awards Gallery'
                    : 'Ham Radio Awards Gallery', 
                data: { 
                    slides, 
                    hide_title,
                    icon_class: iconEl ? iconEl.className : 'fas fa-trophy',
                    icon_color: colorMatch ? colorMatch[1].trim() : '#be954e',
                } 
            });

        // ── Grid IMG ───────────────────────────────────────────────────────
        } else if (el.matches('.image-grid-section')) {
            if (gridImgData && typeof gridImgData === 'object') {
                sections.push({
                    type: 'gridimg',
                    title: gridImgData.title || 'Grid IMG',
                    data: {
                        icon_class: gridImgData.icon_class || 'fas fa-images',
                        icon_color: gridImgData.icon_color || '#be954e',
                        columns: [1, 2, 3].includes(Number(gridImgData.columns)) ? Number(gridImgData.columns) : 3,
                        hide_title: Boolean(gridImgData.hide_title),
                        items: Array.isArray(gridImgData.items) ? gridImgData.items : [],
                    },
                });
            } else {
                const heading = el.querySelector('.image-grid-header h2');
                const iconEl = heading?.querySelector('i');
                const iconStyle = iconEl?.getAttribute('style') || '';
                const colorMatch = iconStyle.match(/color\s*:\s*([^;]+)/);
                const gridEl = el.querySelector('.image-grid');
                const styleAttr = gridEl?.getAttribute('style') || '';
                const colMatch = styleAttr.match(/--img-grid-columns\s*:\s*([123])/i);
                const columns = colMatch ? Number(colMatch[1]) : 3;
                const hide_title = !heading;

                const items = [];
                el.querySelectorAll('.image-grid-item').forEach(tile => {
                    const imgEl = tile.querySelector('img');
                    if (!imgEl) return;
                    const capEl = tile.querySelector('.image-grid-caption');
                    const linkEl = tile.matches('a') ? tile : tile.querySelector('a');
                    items.push({
                        imageUrl: imgEl.getAttribute('src') || '',
                        alt: imgEl.getAttribute('alt') || '',
                        caption: capEl?.textContent.trim() || '',
                        linkUrl: linkEl?.getAttribute('href') || '',
                    });
                });

                sections.push({
                    type: 'gridimg',
                    title: heading
                        ? Array.from(heading.childNodes)
                            .filter(n => n.nodeType === 3)
                            .map(n => n.textContent.trim())
                            .join('').trim() || 'Grid IMG'
                        : 'Grid IMG',
                    data: {
                        icon_class: iconEl ? iconEl.className : 'fas fa-images',
                        icon_color: colorMatch ? colorMatch[1].trim() : '#be954e',
                        columns,
                        hide_title,
                        items,
                    },
                });
            }

        // ── Quick Links ─────────────────────────────────────────────────────
        } else if (el.matches('.quick-links-section')) {
            const titleH2    = el.querySelector('.quick-links-header h2');
            const iconEl     = titleH2?.querySelector('i');
            const icon_class = iconEl ? iconEl.className : 'fas fa-link';
            const iconStyle  = iconEl?.getAttribute('style') || '';
            const colorMatch = iconStyle.match(/color\s*:\s*([^;]+)/);
            const icon_color = colorMatch ? colorMatch[1].trim() : '#be954e';
            const hide_title = !titleH2;
            const sectionTitle = titleH2
                ? Array.from(titleH2.childNodes)
                    .filter(n => n.nodeType === 3)
                    .map(n => n.textContent.trim())
                    .join('').trim() || 'Quick Links'
                : 'Quick Links';
            const links = [];
            el.querySelectorAll('.quick-link-btn').forEach(btn => {
                const label     = btn.textContent.trim();
                const url       = btn.getAttribute('href') || '';
                const bgMatch   = (btn.getAttribute('style') || '').match(/background\s*:\s*([^;]+)/);
                const btn_color = bgMatch ? bgMatch[1].trim() : '#2563eb';
                if (label && url) links.push({ label, url, btn_color });
            });
            sections.push({ type: 'links', title: sectionTitle, data: { icon_class, icon_color, links, hide_title } });

        // ── Propagation / Embedded Img (.propagation-section) ──────────────
        } else if (el.matches('.propagation-section')) {
            const imgs       = el.querySelectorAll('.propagation-img, img');
            const imgEl      = imgs[0] || null;
            const img2El     = imgs[1] || null;
            const creditEl   = el.querySelector('.propagation-credit');
            const creditLink = creditEl?.querySelector('a');
            const titleH2    = el.querySelector('.propagation-header h2');
            const iconEl     = titleH2?.querySelector('i');
            const iconStyle  = iconEl?.getAttribute('style') || '';
            const colorMatch = iconStyle.match(/color\s*:\s*([^;]+)/);
            const icon_color = colorMatch ? colorMatch[1].trim() : '#be954e';
            const hide_title = !titleH2;
            const propTitle  = titleH2
                ? Array.from(titleH2.childNodes)
                    .filter(n => n.nodeType === 3)
                    .map(n => n.textContent.trim())
                    .join('').trim() || 'Embedded Img'
                : 'Embedded Img';
            sections.push({
                type:  'propagation',
                title: propTitle,
                data:  {
                    icon_class:  iconEl ? iconEl.className : 'fas fa-image',
                    icon_color,
                    img_url:     imgEl?.getAttribute('src')  || 'https://www.hamqsl.com/solar101vhf.php',
                    img2_url:    img2El?.getAttribute('src') || '',
                    credit_text: creditEl?.textContent.trim() || '',
                    credit_url:  creditLink?.getAttribute('href') || 'https://www.hamqsl.com/solar.html',
                    hide_title,
                },
            });

        // ── Legacy .propagation-widget not wrapped in .propagation-section ──
        } else if (el.matches('.propagation-widget') && !el.closest('.propagation-section')) {
            const imgs       = el.querySelectorAll('.propagation-img, img');
            const imgEl      = imgs[0] || null;
            const img2El     = imgs[1] || null;
            const creditEl   = el.querySelector('.propagation-credit');
            const creditLink = creditEl?.querySelector('a');
            sections.push({
                type:  'propagation',
                title: 'Embedded Img',
                data:  {
                    icon_class:  'fas fa-image',
                    icon_color:  '#be954e',
                    img_url:     imgEl?.getAttribute('src')  || 'https://www.hamqsl.com/solar101vhf.php',
                    img2_url:    img2El?.getAttribute('src') || '',
                    credit_text: creditEl?.textContent.trim() || '',
                    credit_url:  creditLink?.getAttribute('href') || 'https://www.hamqsl.com/solar.html',
                },
            });
        }
    });

    // Write to DB
    replaceSections(projectId, sections);

    // Parse :root CSS variables → theme (best-effort – never blocks section import)
    try {
        const theme = _parseThemeFromCss(htmlText);
        if (Object.keys(theme).length > 0) {
            replaceTheme(projectId, theme);
        }
    } catch (e) {
        console.warn('Theme import failed (non-fatal):', e);
    }

    return sections.length;
}

// ── DOM parse helpers ──────────────────────────────────────────────────────────

function section_title_from_iframe(iframeEl) {
    return iframeEl?.getAttribute('title') || 'Embedded Widget';
}

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

function _parseThemeFromCss(htmlText) {
    // Extract the first :root { … } block from inline <style> tags
    const rootMatch = htmlText.match(/:root\s*\{([^}]+)\}/);
    if (!rootMatch) return {};

    const block = rootMatch[1];
    const get = (varName) => {
        const m = block.match(new RegExp(varName + '\\s*:\\s*([^;]+)'));
        return m ? m[1].trim() : null;
    };

    const theme = {};
    const primary   = get('--primary');
    const secondary = get('--secondary');
    const bg        = get('--bg');
    const text      = get('--text');
    const accent    = get('--accent');
    const h2Color   = get('--h2-color');
    const sectionBg = get('--section-bg');
    const headerBg  = get('--header-bg');
    const headerTxt = get('--header-text');

    if (primary)   theme.primary_color   = primary;
    if (secondary) theme.secondary_color = secondary;
    if (bg)        theme.bg_color        = bg;
    if (text)      theme.text_color      = text;
    if (accent)    theme.accent_color    = accent;
    if (h2Color)   theme.h2_color        = h2Color;
    if (sectionBg) theme.section_bg      = sectionBg;
    if (headerBg)  theme.header_bg       = headerBg;
    if (headerTxt) theme.header_text_color = headerTxt;

    return theme;
}
