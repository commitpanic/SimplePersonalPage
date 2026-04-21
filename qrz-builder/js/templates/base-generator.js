/**
 * templates/base-generator.js
 *
 * Generates a complete qrz_bio.html (the content pasted into QRZ.com)
 * from sections[] and theme data.
 *
 * Output format is compatible with gallery-manager.html and youtube-manager.html:
 *   GAL-MANAGER-START / GAL-DATA: / GAL-MANAGER-END
 *   YT-MANAGER-START  / YT-DATA:  / YT-MANAGER-END
 */

'use strict';

import { extractVideoId } from '../sections/youtube.js';

// ── Public entry point ─────────────────────────────────────────────────────────

export function generateFullHtml(sections, theme) {
    const t = {
        primary_color:      theme.primary_color      || '#be954e',
        secondary_color:    theme.secondary_color    || '#2563eb',
        bg_color:           theme.bg_color           || '#151518',
        text_color:         theme.text_color         || '#e7e5df',
        accent_color:       theme.accent_color       || '#ff0000',
        font_family:        theme.font_family        || 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        h2_color:           theme.h2_color           || '#ffffff',
        section_bg:         theme.section_bg         || '#151518',
        header_bg:          theme.header_bg          || 'rgba(0,0,0,0.8)',
        header_text:        theme.header_text_color  || '#ffffff',
    };

    const visibleSections = sections.filter(s => s.visible);

    // Split sections by type for easier lookup
    const byType = {};
    for (const s of visibleSections) {
        if (!byType[s.type]) byType[s.type] = [];
        byType[s.type].push(s);
    }

    const headerSec    = byType.header?.[0];
    const textSecs     = byType.text    || [];
    const stationSec   = byType.station?.[0];
    const mapSec       = byType.map?.[0];
    const ytSec        = byType.youtube?.[0];
    const galSec       = byType.gallery?.[0];
    const propSec      = byType.propagation?.[0];
    const iframeSecs   = byType.iframe   || [];

    // Build section HTML blocks
    const sectionBlocks = [];

    // Follow the stored position order
    for (const sec of visibleSections) {
        switch (sec.type) {
            case 'header':      /* rendered separately below */        break;
            case 'text':        sectionBlocks.push(genTextSection(sec, t));     break;
            case 'station':     sectionBlocks.push(genStationSection(sec, t));  break;
            case 'map':         sectionBlocks.push(genMapSection(sec, t));      break;
            case 'youtube':     sectionBlocks.push(genYouTubeSection(sec, t));  break;
            case 'gallery':     sectionBlocks.push(genGallerySection(sec, t));  break;
            case 'propagation': sectionBlocks.push(genPropagationSection(sec, t)); break;
            case 'iframe':      sectionBlocks.push(genIframeSection(sec, t));   break;
            case 'links':       sectionBlocks.push(genLinksSection(sec, t));    break;
        }
    }

    return `<!-- QRZ.com Bio Page Content - Copy everything between these comments -->

<style>
/* ── Reset & Base ───────────────────────────────────────── */
* { margin: 0; padding: 0; box-sizing: border-box; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

/* ── Theme Variables ────────────────────────────────────── */
:root {
    --primary:     ${t.primary_color};
    --secondary:   ${t.secondary_color};
    --bg:          ${t.bg_color};
    --text:        ${t.text_color};
    --accent:      ${t.accent_color};
    --h2-color:    ${t.h2_color};
    --section-bg:  ${t.section_bg};
    --header-bg:   ${t.header_bg};
    --header-text: ${t.header_text};
    --box-width:   900px;
}

/* ── Header ─────────────────────────────────────────────── */
.header { background: var(--header-bg); padding: 20px 0; position: relative; z-index: 100; }
.header-content { display: flex; justify-content: space-between; align-items: center; }
.callsign { font-size: 3rem; font-weight: bold; color: var(--header-text); text-shadow: 2px 2px 4px rgba(0,0,0,0.5); margin-bottom: 5px; }
.location { color: var(--header-text); opacity: 0.8; font-size: 1.1rem; }
.location i { margin-right: 8px; color: var(--accent); }
.radio-icon { font-size: 4rem; color: var(--primary); }
${genIconAnimation(headerSec?.data?.icon_animation || 'pulse')}

/* ── Main Content ───────────────────────────────────────── */
.main-content { background: var(--bg); padding-top: 20px; overflow: hidden; }

/* ── Welcome / Text Section ─────────────────────────────── */
.welcome-section  { padding: 40px 0; text-align: center; background: var(--section-bg); border-radius: 20px 20px 0 0; }
.welcome-section2 { padding: 40px 0; text-align: center; background: var(--section-bg); border-radius: 20px; }
.welcome-section h2, .welcome-section2 h2 { font-size: 2.5rem; color: var(--h2-color); margin-bottom: 20px; position: relative; }
.welcome-section h2::after, .welcome-section2 h2::after { content:''; width:100px; height:4px; background:var(--primary); position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); border-radius:2px; }
.bio-text { max-width: 800px; margin: 0 auto; font-size: 1.1rem; color: var(--text); }
.bio-text p,
.welcome-section p,
.welcome-section2 p,
.youtube-header p,
.awards-header p { color: var(--text) !important; margin-bottom: 15px; }

/* ── Station Section ────────────────────────────────────── */
.station-section { padding: 60px 0; background: var(--bg); }
.station-section h2 { text-align: center; font-size: 2.2rem; color: var(--h2-color); margin-bottom: 40px; }
.station-section h2 i { margin-right: 15px; color: var(--primary); }
.station-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 25px; }
.station-item { background: var(--section-bg); padding: 25px; border-radius: 15px; text-align: center; border: 1px solid rgba(245,158,11,0.2); transition: transform .3s; flex: 0 1 calc(33.333% - 17px); min-width: 220px; max-width: 340px; }
.station-item:hover { transform: translateY(-3px); border-color: rgba(245,158,11,0.4); }
.station-item h3 { color: var(--primary); margin-bottom: 10px; font-size: 1.3rem; }
.station-item p  { color: var(--text); font-size: 1.1rem; }

/* ── Map Section ────────────────────────────────────────── */
.map-section { padding: 60px 0; background: var(--bg); color: var(--text); }
.map-header { text-align: center; margin-bottom: 30px; }
.map-header h2 { font-size: 2.5rem; margin-bottom: 15px; color: var(--h2-color); }
.map-header h2 i { margin-right: 15px; color: var(--accent); }
.map-embed { max-width: var(--box-width); margin: 0 auto; padding: 20px; background: var(--section-bg); border-radius: 20px; }

/* ── Embedded Gadget Section ────────────────────────────── */
.embed-section { padding: 60px 0; background: var(--bg); color: var(--text); }
.embed-header { text-align: center; margin-bottom: 30px; }
.embed-header h2 { font-size: 2.5rem; margin-bottom: 15px; color: var(--h2-color); }
.embed-header h2 i { margin-right: 15px; color: var(--primary); }
.embed-frame-wrap { max-width: var(--box-width); margin: 0 auto; padding: 20px; background: var(--section-bg); border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
.embed-frame-wrap iframe { display: block; margin: 0 auto; max-width: 100%; border-radius: 12px; }

/* ── Quick Links Section ────────────────────────────────── */
.quick-links-section { padding: 60px 0; background: var(--bg); color: var(--text); }
.quick-links-header { text-align: center; margin-bottom: 40px; }
.quick-links-header h2 { font-size: 2.5rem; margin-bottom: 15px; color: var(--h2-color, #fff); }
.quick-links-header h2 i { margin-right: 15px; }
.quick-links-list { max-width: var(--box-width); margin: 0 auto; }
.quick-link-btn { display: block; width: 100%; padding: 16px 24px; border-radius: 10px; text-align: center; font-size: 1.1rem; font-weight: 600; color: #fff; text-decoration: none; margin-bottom: 12px; transition: opacity .2s, transform .2s; }
.quick-link-btn:hover { opacity: .88; transform: translateY(-2px); }

/* ── YouTube Section ────────────────────────────────────── */
.youtube-section { padding: 60px 0; background: var(--bg); color: var(--text); }
.youtube-header { text-align: center; margin-bottom: 50px; }
.youtube-header h2 { font-size: 2.5rem; margin-bottom: 15px; color: var(--h2-color); }
.youtube-header h2 i { margin-right: 15px; color: #ff0000; }
.youtube-gallery-container { max-width: var(--box-width); margin: 0 auto; }
.youtube-gallery-wrapper { position: relative; background: rgba(255,0,0,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 30px; border: 1px solid rgba(255,0,0,0.25); }
.youtube-gallery-slides { position: relative; height: 600px; overflow: hidden; border-radius: 15px; }
.youtube-slide { position: absolute; top:0; left:0; width:100%; height:100%; opacity:0; transform:translateX(100%); transition:all .5s ease-in-out; display:flex; justify-content:center; align-items:center; }
.youtube-card { background:#1a1a1a; border-radius:15px; box-shadow:0 15px 35px rgba(0,0,0,0.3); overflow:hidden; max-width:90%; width:100%; max-height:95%; display:flex; flex-direction:column; border:1px solid rgba(255,0,0,0.25); }
.youtube-thumbnail-container { position:relative; width:100%; height:480px; overflow:hidden; background:#000; border-bottom:3px solid var(--accent); cursor:pointer; }
.youtube-thumbnail { width:100%; height:100%; object-fit:cover; }
.play-overlay { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:80px; height:80px; background:rgba(255,0,0,0.9); border-radius:50%; display:flex; align-items:center; justify-content:center; pointer-events:none; transition:transform .3s; }
.youtube-thumbnail-container:hover .play-overlay { transform:translate(-50%,-50%) scale(1.1); }
.play-overlay i { color:white; font-size:2.5rem; margin-left:5px; }
.youtube-info { padding:20px 25px; text-align:center; color:var(--text); flex-shrink:0; background:var(--section-bg); }
.youtube-info h3 { font-size:1.4rem; margin-bottom:10px; color:var(--text); }
.youtube-info p  { color:var(--text); margin-bottom:15px; }
.watch-btn { display:inline-block; background:var(--accent); color:white; padding:10px 25px; border-radius:25px; font-size:1rem; font-weight:600; text-decoration:none; }
.youtube-date { display:inline-block; background:var(--accent); color:white; padding:5px 15px; border-radius:20px; font-size:0.9rem; font-weight:500; }
.youtube-gallery-navigation { display:flex; justify-content:center; align-items:center; gap:30px; margin-top:25px; }
.youtube-nav-set { display:none; align-items:center; gap:30px; }
.youtube-arrow { width:50px; height:50px; border-radius:50%; background:rgba(255,0,0,0.8); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:1.5rem; border:2px solid rgba(255,255,255,0.3); transition:all .3s; }
.youtube-arrow:hover { background:rgba(255,0,0,1); transform:scale(1.1); }
.youtube-slide-counter { color:white; font-size:1.1rem; font-weight:600; min-width:80px; text-align:center; }

/* ── Gallery / Awards Section ───────────────────────────── */
.awards-section { padding: 60px 0; background: var(--bg); color: var(--text); }
.awards-header { text-align: center; margin-bottom: 50px; }
.awards-header h2 { font-size: 2.5rem; margin-bottom: 15px; color: var(--h2-color); }
.awards-header h2 i { margin-right: 15px; color: var(--secondary); }
.gallery-container { max-width: var(--box-width); margin: 0 auto; }
.gallery-wrapper { position:relative; background:rgba(59,130,246,0.12); backdrop-filter:blur(10px); border-radius:20px; padding:30px; border:1px solid rgba(59,130,246,0.24); }
.gallery-slides { position:relative; height:700px; overflow:hidden; border-radius:15px; }
.slide { position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; transform:translateX(100%); transition:all .5s ease-in-out; display:flex; justify-content:center; align-items:center; }
.award-card { background:var(--section-bg); border-radius:15px; box-shadow:0 15px 35px rgba(0,0,0,0.2); overflow:hidden; max-width:85%; width:100%; max-height:90%; display:flex; flex-direction:column; }
.award-card img { width:100%; height:auto; max-height:480px; object-fit:contain; border-bottom:3px solid var(--secondary); background:#f8f9fa; }
.award-info { padding:20px 25px; text-align:center; color:var(--text); flex-shrink:0; }
.award-info h3 { font-size:1.5rem; margin-bottom:10px; color:var(--text); }
.award-info p  { color:var(--text); margin-bottom:15px; }
.award-date { display:inline-block; background:var(--secondary); color:white; padding:5px 15px; border-radius:20px; font-size:0.9rem; }
.gallery-navigation { display:flex; justify-content:center; align-items:center; gap:30px; margin-top:25px; }
.gallery-nav-set { display:none; align-items:center; gap:30px; }
.gallery-arrow { width:50px; height:50px; border-radius:50%; background:rgba(37,99,235,0.82); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:1.5rem; border:2px solid rgba(255,255,255,0.3); transition:all .3s; }
.gallery-arrow:hover { background:rgba(37,99,235,1); transform:scale(1.1); }
.slide-counter { color:white; font-size:1.1rem; font-weight:600; min-width:80px; text-align:center; }

/* ── Propagation Section ────────────────────────────────── */
.propagation-section { padding: 40px 0; background: var(--bg); }
.propagation-header { text-align: center; margin-bottom: 30px; }
.propagation-header h2 { font-size: 2.5rem; margin-bottom: 15px; color: var(--h2-color); }
.propagation-header h2 i { margin-right: 15px; }
.propagation-widget { background: var(--section-bg); border-radius:15px; overflow:hidden; max-width: var(--box-width); margin:0 auto; }
.propagation-banner { display:flex; flex-direction:column; align-items:center; gap:15px; padding:20px; }
.propagation-banner > a { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; margin:0 auto; text-align:center; }
.propagation-img { max-width:100%; height:auto; border-radius:8px; }
.propagation-credit { text-align:center; color:var(--text); margin:0; }
.propagation-credit a { color:var(--primary); text-decoration:none; font-weight:500; }

/* ── Footer ─────────────────────────────────────────────── */
.footer { background: #1c1c21; color: white; text-align: center; padding: 30px 0; }

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 768px) {
    .callsign { font-size: 2rem; }
    .header-content { flex-direction: column; gap: 15px; text-align: center; }
    .gallery-slides { height: 550px; }
    .youtube-gallery-slides { height: 450px; }
    .station-grid { grid-template-columns: 1fr; }
}
</style>

<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

<!-- QRZ Bio Content Wrapper -->
<div style="font-family: ${esc(t.font_family)}; line-height: 1.6; color: ${esc(t.text_color)}; background: linear-gradient(135deg, #0b0b0d 0%, ${esc(t.bg_color)} 100%); overflow: hidden;">

${headerSec ? genHeader(headerSec, t) : ''}

<!-- Main Content -->
<main class="main-content">
    <div class="container">
${sectionBlocks.join('\n\n')}
    </div>
</main>

<!-- Footer -->
<footer class="footer">
    <p>Generated by QRZ Page Builder &bull; 73 de ${esc(headerSec?.data?.callsign || '')}</p>
</footer>

</div><!-- end wrapper -->
<!-- End QRZ.com Bio Page Content -->`;
}

// ── Section generators ─────────────────────────────────────────────────────────

function genHeader(sec, t) {
    const d = sec.data || {};
    const callsign = d.callsign || '';
    const location = d.location || '';
    const mapsUrl  = d.maps_url || (location ? 'https://maps.google.com/?q=' + encodeURIComponent(location) : '');
    const email    = d.email    || '';
    const logoUrl  = d.logo_url || '';
    const iconCls  = d.icon_class || 'fas fa-broadcast-tower';
    const links    = d.links || [];

    const linksHtml = links.map(l => `
                    <i class="${esc(l.icon || 'fas fa-link')}" style="margin-left: 8px; color: var(--secondary);"></i>
                    <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"
                              style="color:var(--text);text-decoration:none;font-size:1rem;"
                       onmouseover="this.style.color='${t.primary_color}'"
                              onmouseout="this.style.color=''">${esc(l.label)}</a>`).join('');

    const logoHtml = logoUrl
        ? `<img src="${esc(logoUrl)}" alt="Logo" style="height:80px;width:auto;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">`
        : '';

    return `<!-- Header Section -->
<header class="header">
    <div class="container">
        <div class="header-content">
            <div class="callsign-section">
                <h1 class="callsign">${esc(callsign)}</h1>
                <div class="location">
                    <i class="fas fa-map-marker-alt"></i>${mapsUrl
                        ? `<a href="${esc(mapsUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--text);text-decoration:none;border-bottom:1px dotted rgba(255,255,255,0.35);" onmouseover="this.style.borderBottomColor='${t.primary_color}'" onmouseout="this.style.borderBottomColor='rgba(255,255,255,0.35)'">${esc(location)}</a>`
                        : esc(location)}
                    ${email ? `<i class="fas fa-mail-bulk" style="margin-left:8px;color:var(--secondary);"></i>
                    <span style="color:var(--text);font-size:1rem;">${esc(email)}</span>` : ''}
                </div>
            </div>
            ${logoHtml ? `<div style="margin-left:auto;">${logoHtml}</div>` : ''}
            <div class="radio-icon">
                <i class="${esc(iconCls)}"></i>
            </div>
        </div>
        ${linksHtml ? `<div>${linksHtml}</div>` : ''}
    </div>
</header>`;
}

function genIconAnimation(type) {
    switch (type) {
        case 'glow':   return `@keyframes glow   { 0%,100%{text-shadow:0 0 5px var(--primary);} 50%{text-shadow:0 0 20px var(--primary),0 0 40px var(--primary);} }\n.radio-icon i{animation:glow 2s infinite;}`;
        case 'bounce': return `@keyframes bounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-10px);} }\n.radio-icon i{animation:bounce 1.5s infinite;}`;
        case 'rotate': return `@keyframes rotate { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }\n.radio-icon i{animation:rotate 3s linear infinite;}`;
        case 'none':   return '';
        default:       return `@keyframes pulse  { 0%,100%{transform:scale(1);} 50%{transform:scale(1.1);} }\n.radio-icon i{animation:pulse 2s infinite;}`;
    }
}

function genTextSection(sec, t) {
    const d = sec.data || {};
    return `
        <!-- Text Section: ${esc(sec.title)} -->
        <section class="welcome-section2">
            <h2>${esc(sec.title)}</h2>
            <div class="bio-text">${d.content || ''}</div>
        </section>`;
}

function genStationSection(sec, t) {
    const d = sec.data || {};
    const items = d.items || [];
    const cardsHtml = items.map(item => `
                <div class="station-item">
                    <h3>${esc(item.key)}</h3>
                    <p>${esc(item.value)}</p>
                </div>`).join('');

    return `
        <!-- Station Info Section -->
        <section class="station-section">
            <h2><i class="fas fa-radio"></i> ${esc(sec.title)}</h2>
            <div class="station-grid">
${cardsHtml}
            </div>
        </section>`;
}

function genMapSection(sec, t) {
    const d = sec.data || {};
    return `
        <!-- Map Section -->
        <section class="map-section">
            <div class="map-header">
                <h2><i class="fas fa-map-marked-alt"></i> ${esc(sec.title)}</h2>
            </div>
            <div class="map-embed">
                <iframe src="${esc(d.iframe_src || '')}" title="${esc(d.iframe_title || sec.title)}"
                        loading="lazy"
                        style="width:100%;height:${parseInt(d.height,10)||1125}px;border:0;border-radius:12px;overflow:hidden;"></iframe>
            </div>
        </section>`;
}

function genYouTubeSection(sec, t) {
    const d      = sec.data || {};
    const slides = d.slides || [];
    if (!slides.length) return '';

    const n = slides.length;

    const slideSelectors = slides.map((_,i) =>
        `        #yts${i+1}:checked ~ .youtube-gallery-slides .youtube-slide-${i+1}`
    ).join(',\n');

    const navSelectors = slides.map((_,i) =>
        `        #yts${i+1}:checked ~ .youtube-gallery-navigation .ytnav-${i+1}`
    ).join(',\n');

    const radioHtml = slides.map((_,i) =>
        `                        <input type="radio" name="ytslide" id="yts${i+1}"${i===0?' checked':''} style="display:none;">`
    ).join('\n');

    const slidesHtml = slides.map((s, i) => {
        const vid = extractVideoId(s.url) || '';
        const pos = i + 1;
        return `
                            <!-- Slide ${pos}: ${esc(s.title)} -->
                            <div class="youtube-slide youtube-slide-${pos}">
                                <div class="youtube-card">
                                    <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="youtube-thumbnail-container">
                                        <img src="https://img.youtube.com/vi/${vid}/maxresdefault.jpg" alt="${esc(s.title)}" class="youtube-thumbnail">
                                        <div class="play-overlay"><i class="fab fa-youtube"></i></div>
                                    </a>
                                    <div class="youtube-info">
                                        <h3>${esc(s.title)}</h3>
                                        <p>${esc(s.description || '')}</p>
                                        <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="watch-btn">
                                            <i class="fab fa-youtube"></i> Watch on YouTube
                                        </a><br><br>
                                        <span class="youtube-date">${esc(s.year || '2026')}</span>
                                    </div>
                                </div>
                            </div>`;
    }).join('\n');

    const navHtml = slides.map((_,i) => {
        const pos  = i + 1;
        const prev = i === 0     ? n   : i;
        const next = i === n - 1 ? 1   : i + 2;
        return `
                            <div class="youtube-nav-set ytnav-${pos}">
                                <label for="yts${prev}" class="youtube-arrow"><i class="fas fa-chevron-left"></i></label>
                                <div class="youtube-slide-counter">${pos} / ${n}</div>
                                <label for="yts${next}" class="youtube-arrow"><i class="fas fa-chevron-right"></i></label>
                            </div>`;
    }).join('\n');

    const dataComment = `<!-- YT-DATA:${JSON.stringify(slides)} -->`;

    return `<!-- YT-MANAGER-START -->
${dataComment}
<style>
/* YouTube gallery CSS — auto-generated by qrz-builder */
${slideSelectors} { opacity:1; transform:translateX(0); }
${navSelectors} { display:flex; }
</style>
        <!-- YouTube Videos Section -->
        <section class="youtube-section">
            <div class="container">
                <div class="youtube-header">
                    <h2><i class="fab fa-youtube"></i> ${esc(sec.title)}</h2>
                </div>
                <div class="youtube-gallery-container">
                    <div class="youtube-gallery-wrapper">
${radioHtml}
                        <div class="youtube-gallery-slides">
${slidesHtml}
                        </div>
                        <div class="youtube-gallery-navigation">
${navHtml}
                        </div>
                    </div>
                </div>
            </div>
        </section>
<!-- YT-MANAGER-END -->`;
}

function genGallerySection(sec, t) {
    const d      = sec.data || {};
    const iconClass = d.icon_class || 'fas fa-trophy';
    const iconColor = d.icon_color || t.primary_color;
    const themeColor = d.theme_color || t.secondary_color;
    const themeBg = hexToRgba(themeColor, 0.12);
    const themeBorder = hexToRgba(themeColor, 0.24);
    const themeArrow = hexToRgba(themeColor, 0.82);
    const slides = d.slides || [];
    const galleryKey = `gl-${String(sec.id ?? sec.position ?? sec.title ?? 'gallery').replace(/[^a-z0-9_-]/gi, '') || 'gallery'}`;
    const n = slides.length;

    const slideSelectors = slides.map((_,i) =>
        `        #${galleryKey}-s${i+1}:checked ~ .gallery-slides .gslide-${i+1}`
    ).join(',\n');

    const navSelectors = slides.map((_,i) =>
        `        #${galleryKey}-s${i+1}:checked ~ .gallery-navigation .gnav-${i+1}`
    ).join(',\n');

    const radioHtml = slides.map((_,i) =>
        `                    <input type="radio" name="${galleryKey}-slide" id="${galleryKey}-s${i+1}"${i===0?' checked':''} style="display:none;">`
    ).join('\n');

    const slidesHtml = slides.length
        ? slides.map((s, i) => {
            const pos = i + 1;
            return `
                        <div class="slide gslide-${pos}">
                            <div class="award-card">
                                <img src="${esc(s.imageUrl)}" alt="${esc(s.alt || s.title)}" style="border-bottom:3px solid ${esc(themeColor)};">
                                <div class="award-info">
                                    <h3>${esc(s.title)}</h3>
                                    <p>${esc(s.description || '')}</p>
                                    <span class="award-date" style="background:${esc(themeColor)};">Year: ${esc(s.year || '2025')}</span>
                                </div>
                            </div>
                        </div>`;
        }).join('\n')
        : `
                        <div style="height:100%;display:flex;align-items:center;justify-content:center;">
                            <div class="award-card" style="max-width:620px;max-height:none;">
                                <div class="award-info" style="padding:40px 30px;">
                                    <h3>No slides yet</h3>
                                    <p>Add at least one image to see the gallery carousel in the preview.</p>
                                </div>
                            </div>
                        </div>`;

    const navHtml = slides.map((_,i) => {
        const pos  = i + 1;
        const prev = i === 0     ? n   : i;
        const next = i === n - 1 ? 1   : i + 2;
        return `
                        <div class="gallery-nav-set gnav-${pos}">
                            <label for="${galleryKey}-s${prev}" class="gallery-arrow" style="background:${esc(themeArrow)};"><i class="fas fa-chevron-left"></i></label>
                            <div class="slide-counter">${pos} / ${n}</div>
                            <label for="${galleryKey}-s${next}" class="gallery-arrow" style="background:${esc(themeArrow)};"><i class="fas fa-chevron-right"></i></label>
                        </div>`;
    }).join('\n');

    const dataComment = `<!-- GAL-DATA:${JSON.stringify(slides)} -->`;

    return `<!-- GAL-MANAGER-START -->
${dataComment}
<style>
/* Gallery CSS — auto-generated by qrz-builder */
${slideSelectors ? `${slideSelectors} { opacity:1; transform:translateX(0); }` : ''}
${navSelectors ? `${navSelectors} { display:flex; }` : ''}
</style>
        <!-- Ham Awards Gallery Section -->
        <section class="awards-section">
            <div class="awards-header">
                <h2><i class="${esc(iconClass)}" style="color:${esc(iconColor)};"></i> ${esc(sec.title)}</h2>
            </div>
            <div class="gallery-container">
                <div class="gallery-wrapper" style="background:${esc(themeBg)};border:1px solid ${esc(themeBorder)};">
${radioHtml}
                    <div class="gallery-slides">
${slidesHtml}
                    </div>
${navHtml ? `                    <div class="gallery-navigation">
${navHtml}
                    </div>` : ''}
                </div>
            </div>
        </section>
<!-- GAL-MANAGER-END -->`;
}

function genPropagationSection(sec, t) {
    const d = sec.data || {};
    const iconClass = d.icon_class || 'fas fa-image';
    const iconColor = d.icon_color || t.primary_color;
    const img2 = d.img2_url ? `
                        <img src="${esc(d.img2_url)}" alt="Solar Map" class="propagation-img" style="margin-top:15px;">` : '';
    return `
        <!-- Propagation Section -->
        <section class="propagation-section">
            <div class="propagation-header">
                <h2><i class="${esc(iconClass)}" style="color:${esc(iconColor)};"></i>${esc(sec.title || 'Embedded Img')}</h2>
            </div>
            <div class="propagation-widget">
                <div class="propagation-banner">
                    <a href="${esc(d.credit_url || '#')}" target="_blank" rel="noopener noreferrer">
                        <img src="${esc(d.img_url || '')}" alt="${esc(sec.title || 'Embedded Img')}" class="propagation-img">${img2}
                    </a>
                    <p class="propagation-credit">
                        <a href="${esc(d.credit_url || '#')}" target="_blank" rel="noopener noreferrer">
                            ${esc(d.credit_text || 'Embedded Img')}
                        </a>
                    </p>
                </div>
            </div>
        </section>`;
}

function genIframeSection(sec, t) {
    const d = sec.data || {};
    const iconClass = d.icon_class || 'fas fa-puzzle-piece';
    const iconColor = d.icon_color || t.primary_color;
    return `
        <!-- iFrame Section: ${esc(sec.title)} -->
        <section class="embed-section">
            <div class="container">
                <div class="embed-header">
                    <h2><i class="${esc(iconClass)}" style="color:${esc(iconColor)};"></i>${esc(sec.title || 'Embedded Gadget')}</h2>
                </div>
                <div class="embed-frame-wrap">
                    <iframe src="${esc(d.src || '')}"
                            title="${esc(d.title || sec.title)}"
                            style="width:${esc(d.width||'100%')};height:${esc(d.height||'400px')};border:0;"
                            loading="lazy"></iframe>
                </div>
            </div>
        </section>`;
}

function genLinksSection(sec, t) {
    const d = sec.data || {};
    const iconClass = d.icon_class || 'fas fa-link';
    const iconColor = d.icon_color || t.primary_color;
    const items = d.links || [];

    const btnHtml = items.length
        ? items.map(lnk => `
                        <a href="${esc(lnk.url)}" class="quick-link-btn" style="background:${esc(lnk.btn_color || t.secondary_color)};" target="_blank" rel="noopener noreferrer">
                            ${esc(lnk.label)}
                        </a>`).join('\n')
        : `<p style="color:#888;text-align:center;">No links added yet.</p>`;

    return `
        <!-- Quick Links Section -->
        <section class="quick-links-section">
            <div class="container">
                <div class="quick-links-header">
                    <h2><i class="${esc(iconClass)}" style="color:${esc(iconColor)};"></i>${esc(sec.title || 'Quick Links')}</h2>
                </div>
                <div class="quick-links-list">
${btnHtml}
                </div>
            </div>
        </section>`;
}

// ── Util ───────────────────────────────────────────────────────────────────────
function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function hexToRgba(hex, alpha) {
    const normalized = String(hex || '').trim();
    const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return `rgba(59,130,246,${alpha})`;

    let value = match[1];
    if (value.length === 3) {
        value = value.split('').map(ch => ch + ch).join('');
    }

    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `rgba(${red},${green},${blue},${alpha})`;
}
