/**
 * builder.js – Main controller: project CRUD, section list, routing, state
 */

'use strict';

import { initDb, saveDb,
         createProject, getProjectsByUser, getProject, deleteProject, renameProject, setProjectFilePath,
         getSections, addSection, deleteSection, reorderSections, toggleSectionVisible } from './db.js';
import { requireAuth, logout }                from './auth.js';
import { openHtmlFile, writeToHandle, saveAsHtmlFile, isFileApiSupported } from './fileops.js';
import { renderThemeEditor }                  from './theme.js';
import { renderHeaderEditor }                 from './sections/header.js';
import { renderTextEditor }                   from './sections/text.js';
import { renderGalleryEditor }                from './sections/gallery.js';
import { renderYouTubeEditor }                from './sections/youtube.js';
import { renderStationEditor }                from './sections/station.js';
import { renderMapEditor }                    from './sections/map.js';
import { renderIframeEditor }                 from './sections/iframe.js';
import { renderPropagationEditor }            from './sections/propagation.js';
import { renderLinksEditor }                  from './sections/links.js';
import { generateQrzBio }                     from './exporter.js';
import { importFromHtml }                     from './importer.js';

// ── State ──────────────────────────────────────────────────────────────────────
let session        = null;
let activeProjectId = null;
let fileHandle     = null;
let dragSrc        = -1;

const SECTION_ICONS = {
    header:  'fas fa-heading',
    text:    'fas fa-align-left',
    gallery: 'fas fa-trophy',
    youtube: 'fab fa-youtube',
    station: 'fas fa-broadcast-tower',
    iframe:  'fas fa-puzzle-piece',
    links:   'fas fa-link',
    // legacy (imported pages)
    map:         'fas fa-map-marked-alt',
    propagation: 'fas fa-wave-square',
};

const SECTION_LABELS = {
    header:  'Header',
    text:    'Text / Bio',
    gallery: 'Gallery',
    youtube: 'YouTube Videos',
    station: 'Station Info',
    iframe:  'Embedded Gadget',
    links:   'Quick Links',
    // legacy
    map:         'Ham Map',
    propagation: 'Embedded Img',
};

// ── Boot ───────────────────────────────────────────────────────────────────────
async function init() {
    session = requireAuth();
    if (!session) return;

    await initDb();

    document.getElementById('topbar-user').textContent = session.username;
    document.getElementById('btn-logout').addEventListener('click', () => {
        logout();
        window.location.href = 'index.html';
    });

    document.getElementById('btn-new-project').addEventListener('click', newProject);
    document.getElementById('btn-import-file').addEventListener('click', importFile);
    document.getElementById('btn-export-file').addEventListener('click', exportFile);
    document.getElementById('btn-add-section').addEventListener('click', () => openSectionTypeModal());
    document.getElementById('btn-back-projects').addEventListener('click', closeProject);
    document.getElementById('btn-rename-project').addEventListener('click', renameCurrentProject);

    document.getElementById('btn-theme').addEventListener('click', () => {
        if (!activeProjectId) { alert('Open a project first.'); return; }
        openThemeEditor();
    });

    document.getElementById('btn-preview').addEventListener('click', () => {
        const panel = document.getElementById('right-panel');
        if (!panel) return;
        const visible = panel.style.display !== 'none';
        panel.style.display = visible ? 'none' : 'flex';
        if (!visible) refreshPreview();
    });

    document.getElementById('btn-qrz-instructions').addEventListener('click', openQrzInstructionsModal);

    // Modal close
    document.getElementById('modal-section-type').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-section-type')) closeSectionTypeModal();
    });
    document.getElementById('btn-close-section-modal').addEventListener('click', closeSectionTypeModal);

    document.getElementById('modal-qrz-instructions').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-qrz-instructions')) closeQrzInstructionsModal();
    });
    document.getElementById('btn-close-qrz-instructions').addEventListener('click', closeQrzInstructionsModal);

    // Section type buttons
    document.querySelectorAll('[data-section-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.sectionType;
            closeSectionTypeModal();
            createSection(type);
        });
    });

    renderProjectList();
    setStatus('Welcome, ' + session.username + '! Open a project or create a new one.', 'info');
}

// ── Status bar ─────────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
    const bar = document.getElementById('statusbar');
    bar.textContent = msg;
    bar.className = 'statusbar' + (type ? ' ' + type : '');
}

// ── Project list ───────────────────────────────────────────────────────────────
function renderProjectList() {
    const list = document.getElementById('project-list');
    const projects = getProjectsByUser(session.userId);
    list.innerHTML = '';

    if (!projects.length) {
        list.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:12px 8px;">
            No projects yet.<br>Click + to create one.</div>`;
        return;
    }

    for (const p of projects) {
        const item = document.createElement('div');
        item.className = 'project-item' + (p.id === activeProjectId ? ' active' : '');
        item.dataset.id = p.id;
        const date = p.updated_at ? p.updated_at.substring(0, 10) : '';
        item.innerHTML = `
            <span class="project-icon"><i class="fas fa-broadcast-tower"></i></span>
            <div class="project-info">
                <div class="project-name">${_esc(p.name)}</div>
                <div class="project-meta">${date}</div>
            </div>
            <div class="project-actions">
                <button class="btn btn-danger btn-icon btn-sm" data-del="${p.id}" title="Delete project"><i class="fas fa-trash"></i></button>
            </div>`;

        item.addEventListener('click', e => {
            if (e.target.closest('[data-del]')) return;
            openProject(p.id);
        });
        item.querySelector(`[data-del]`).addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Delete project "${p.name}"? All sections and data will be lost.`)) {
                deleteProject(p.id);
                if (activeProjectId === p.id) closeProject();
                renderProjectList();
                setStatus('Project deleted.', 'info');
            }
        });
        list.appendChild(item);
    }
}

// ── New Project ────────────────────────────────────────────────────────────────
function newProject() {
    const name = prompt('Project name:', 'My QRZ Page');
    if (!name || !name.trim()) return;
    const id = createProject(session.userId, name.trim());
    renderProjectList();
    openProject(id);
    setStatus(`Project "${name.trim()}" created.`, 'success');
}

// ── Open / close project ───────────────────────────────────────────────────────
function openProject(projectId) {
    activeProjectId = projectId;
    fileHandle = null;

    const project = getProject(projectId);
    document.getElementById('topbar-project').textContent = project ? `· ${project.name}` : '';
    document.getElementById('btn-export-file').disabled = false;

    // Switch sidebar to section view
    document.getElementById('view-projects').classList.remove('active');
    document.getElementById('view-sections').classList.add('active');
    document.getElementById('sidebar-project-name').textContent = project?.name || '';

    renderSectionList();
    showWelcomeCanvas();
    renderProjectList(); // re-render to mark active

    setStatus(`Project "${project?.name}" opened. Select a section to edit.`, 'info');
}

function closeProject() {
    activeProjectId = null;
    fileHandle = null;
    document.getElementById('topbar-project').textContent = '';
    document.getElementById('btn-export-file').disabled = true;

    document.getElementById('view-sections').classList.remove('active');
    document.getElementById('view-projects').classList.add('active');

    showWelcomeCanvas();
    renderProjectList();
}

function renameCurrentProject() {
    if (!activeProjectId) return;
    const project = getProject(activeProjectId);
    const newName = prompt('New name:', project?.name || '');
    if (!newName || !newName.trim()) return;
    renameProject(activeProjectId, newName.trim());
    document.getElementById('topbar-project').textContent = `· ${newName.trim()}`;
    document.getElementById('sidebar-project-name').textContent = newName.trim();
    renderProjectList();
    setStatus(`Renamed to "${newName.trim()}"`, 'success');
}

// ── Section list ───────────────────────────────────────────────────────────────
function renderSectionList() {
    const list = document.getElementById('section-list');
    list.innerHTML = '';
    if (!activeProjectId) return;

    const sections = getSections(activeProjectId);
    if (!sections.length) {
        list.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:12px 8px;">No sections yet.<br>Click + to add one.</div>`;
        return;
    }

    sections.forEach((sec, idx) => {
        const item = document.createElement('div');
        item.className = 'section-item' + (!sec.visible ? ' hidden-section' : '');
        item.dataset.id = sec.id;
        item.draggable = true;

        const sidebarIcon = (() => {
            const customIcon = sec.data?.icon_class;
            if (customIcon && ['gallery','iframe','propagation','links'].includes(sec.type)) return customIcon;
            return SECTION_ICONS[sec.type] || 'fas fa-layer-group';
        })();
        item.innerHTML = `
            <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
            <span class="section-type-icon"><i class="${sidebarIcon}"></i></span>
            <span class="section-label">${_esc(sec.title || SECTION_LABELS[sec.type] || sec.type)}</span>
            <div class="section-actions">
                <button class="vis-toggle ${!sec.visible ? 'hidden' : ''}" data-vis="${sec.id}" title="${sec.visible ? 'Hide' : 'Show'}">
                    <i class="fas ${sec.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button class="btn btn-danger btn-icon btn-sm" data-del="${sec.id}" title="Delete section">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;

        item.addEventListener('click', e => {
            if (e.target.closest('[data-vis]') || e.target.closest('[data-del]')) return;
            openSectionEditor(sec.id);
        });

        item.querySelector('[data-vis]').addEventListener('click', e => {
            e.stopPropagation();
            toggleSectionVisible(sec.id);
            renderSectionList();
        });

        item.querySelector('[data-del]').addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Delete section "${sec.title || sec.type}"?`)) {
                deleteSection(sec.id);
                renderSectionList();
                showWelcomeCanvas();
                setStatus('Section deleted.', 'info');
            }
        });

        // Drag-to-reorder
        item.addEventListener('dragstart', () => { dragSrc = idx; item.classList.add('dragging'); });
        item.addEventListener('dragend',   () => { dragSrc = -1; item.classList.remove('dragging'); });
        item.addEventListener('dragover',  e => { e.preventDefault(); item.classList.add('drag-over'); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', e => {
            e.preventDefault();
            item.classList.remove('drag-over');
            if (dragSrc < 0 || dragSrc === idx) return;
            const allSections = getSections(activeProjectId);
            const orderedIds  = allSections.map(s => s.id);
            const [moved]     = orderedIds.splice(dragSrc, 1);
            orderedIds.splice(idx, 0, moved);
            reorderSections(activeProjectId, orderedIds);
            renderSectionList();
        });

        list.appendChild(item);
    });
}

// ── Section type modal ─────────────────────────────────────────────────────────
function openSectionTypeModal() {
    if (!activeProjectId) { alert('Open or create a project first.'); return; }
    document.getElementById('modal-section-type').classList.add('open');
}

function closeSectionTypeModal() {
    document.getElementById('modal-section-type').classList.remove('open');
}

function openQrzInstructionsModal() {
    document.getElementById('modal-qrz-instructions').classList.add('open');
}

function closeQrzInstructionsModal() {
    document.getElementById('modal-qrz-instructions').classList.remove('open');
}

function createSection(type) {
    const defaultTitle = SECTION_LABELS[type] || type;
    const id = addSection(activeProjectId, type, defaultTitle, {});
    renderSectionList();
    openSectionEditor(id);
    setStatus(`Section "${defaultTitle}" added.`, 'success');
}

// ── Section editor routing ─────────────────────────────────────────────────────
function openSectionEditor(sectionId) {
    // Mark active in sidebar
    document.querySelectorAll('.section-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === String(sectionId));
    });

    const sections = getSections(activeProjectId);
    const section  = sections.find(s => s.id === sectionId);
    if (!section) return;

    const canvas = document.getElementById('canvas');
    canvas.innerHTML = ''; // clear previous

    const onSaved = () => {
        renderSectionList();
        setStatus(`Section "${section.title || section.type}" saved.`, 'success');
        // Refresh preview if open
        refreshPreview();
    };

    switch (section.type) {
        case 'header':      renderHeaderEditor(canvas, section, onSaved); break;
        case 'text':        renderTextEditor(canvas, section, onSaved);   break;
        case 'gallery':     renderGalleryEditor(canvas, section, onSaved); break;
        case 'youtube':     renderYouTubeEditor(canvas, section, onSaved); break;
        case 'station':     renderStationEditor(canvas, section, onSaved); break;
        case 'map':         renderMapEditor(canvas, section, onSaved);    break;
        case 'iframe':      renderIframeEditor(canvas, section, onSaved); break;
        case 'propagation': renderPropagationEditor(canvas, section, onSaved); break;
        case 'links':      renderLinksEditor(canvas, section, onSaved);       break;
        default: canvas.innerHTML = `<div class="welcome-canvas"><i class="fas fa-question-circle"></i><h2>Unknown section type: ${_esc(section.type)}</h2></div>`;
    }
}

function showWelcomeCanvas() {
    const canvas = document.getElementById('canvas');
    if (!activeProjectId) {
        canvas.innerHTML = `
<div class="welcome-canvas">
    <i class="fas fa-broadcast-tower"></i>
    <h2>QRZ Page Builder</h2>
    <p>Create or open a project from the sidebar to get started.</p>
</div>`;
    } else {
        canvas.innerHTML = `
<div class="welcome-canvas">
    <i class="fas fa-layer-group"></i>
    <h2>Select a section to edit</h2>
    <p>Choose a section from the left sidebar, or add a new one with the + button.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px;">
        <button class="btn btn-primary" onclick="document.getElementById('btn-add-section').click()">
            <i class="fas fa-plus"></i> Add Section
        </button>
        <button class="btn btn-secondary" id="btn-open-theme">
            <i class="fas fa-palette"></i> Edit Theme
        </button>
    </div>
</div>`;
        document.getElementById('btn-open-theme')?.addEventListener('click', openThemeEditor);
    }
}

// ── Theme editor ───────────────────────────────────────────────────────────────
function openThemeEditor() {
    document.querySelectorAll('.section-item').forEach(el => el.classList.remove('active'));
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '';
    renderThemeEditor(canvas, activeProjectId, () => {
        setStatus('Theme saved.', 'success');
        refreshPreview();
    }, (liveTheme) => {
        refreshPreview(liveTheme);
    });
}

// ── Preview ────────────────────────────────────────────────────────────────────
function refreshPreview(themeOverride = null) {
    const frame = document.getElementById('preview-frame');
    if (!frame || !activeProjectId) return;
    try {
        const html = generateQrzBio(activeProjectId, themeOverride);
        frame.srcdoc = html;
        frame._refresh = () => refreshPreview();
    } catch (e) {
        console.warn('Preview error:', e);
    }
}

// ── Import ─────────────────────────────────────────────────────────────────────
async function importFile() {
    if (!activeProjectId) { alert('Open or create a project first.'); return; }

    setStatus('Opening file picker…', 'info');
    let result;
    try {
        result = await openHtmlFile();
    } catch (e) {
        setStatus('Error opening file: ' + e.message, 'error');
        return;
    }
    if (!result) { setStatus('Import cancelled.', ''); return; }

    fileHandle = result.handle;
    setProjectFilePath(activeProjectId, result.name);
    document.getElementById('topbar-file-label').textContent = result.name;

    try {
        const count = importFromHtml(result.text, activeProjectId);
        renderSectionList();
        showWelcomeCanvas();
        refreshPreview();
        setStatus(`Imported "${result.name}" — ${count} sections loaded.`, 'success');
    } catch (e) {
        setStatus('Import error: ' + e.message, 'error');
    }
}

// ── Export ─────────────────────────────────────────────────────────────────────
async function exportFile() {
    if (!activeProjectId) return;

    setStatus('Generating HTML…', 'info');
    let html;
    try {
        html = generateQrzBio(activeProjectId);
    } catch (e) {
        setStatus('Export error: ' + e.message, 'error');
        return;
    }

    // Always prompt for save location so user always knows where the file goes.
    // Use the current filename (if known) as the suggested name.
    const suggestedName = fileHandle ? fileHandle.name : 'qrz_bio.html';
    try {
        const result = await saveAsHtmlFile(html, suggestedName);
        if (!result) { setStatus('Export cancelled.', ''); return; }
        fileHandle = result.handle; // null for Firefox (Blob download)
        const label = document.getElementById('topbar-file-label');
        if (label) label.textContent = result.name;
        if (result.handle) {
            setStatus('Saved: ' + result.name, 'success');
        } else {
            setStatus('Downloaded: ' + result.name + ' (check your Downloads folder)', 'success');
        }
    } catch (e) {
        setStatus('Save error: ' + e.message, 'error');
    }
}

// ── Theme / Preview buttons wired in init() ─────────────────────────────────
// (see the init() function above)

// ── Util ───────────────────────────────────────────────────────────────────────
function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── Start ──────────────────────────────────────────────────────────────────────
init().catch(err => {
    console.error('Builder init error:', err);
    document.body.innerHTML = `<div style="color:red;padding:40px;font-family:monospace;">
        Init error: ${err.message}<br><a href="index.html" style="color:#be954e;">← Back to login</a>
    </div>`;
});
