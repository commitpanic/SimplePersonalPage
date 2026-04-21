/**
 * db.js – sql.js (SQLite WASM) initialization, IndexedDB persistence, query helpers
 *
 * Schema:
 *   users    (id, username, password_hash, created_at)
 *   projects (id, user_id, name, source_file_path, created_at, updated_at)
 *   theme    (id, project_id, primary_color, secondary_color, bg_color, text_color,
 *             accent_color, font_family)
 *   sections (id, project_id, type, position, title, visible, data_json)
 */

'use strict';

const IDB_DB_NAME    = 'qrz-builder';
const IDB_STORE_NAME = 'sqlitedb';
const IDB_KEY        = 'main';

let _db = null; // sql.js Database instance

// ── Initialization ─────────────────────────────────────────────────────────────

/**
 * Load sql.js, restore DB from IndexedDB (if exists), apply schema.
 * Returns the sql.js Database instance.
 */
export async function initDb() {
    if (_db) return _db;

    // sql.js is loaded as a global via <script> tag in index.html / builder.html
    if (typeof initSqlJs === 'undefined') {
        throw new Error('sql.js not loaded. Make sure the <script> tag is present.');
    }

    const SQL = await initSqlJs({
        locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`
    });

    const saved = await _idbLoad();
    _db = saved ? new SQL.Database(saved) : new SQL.Database();

    _applySchema(_db);
    return _db;
}

/**
 * Persist current DB state to IndexedDB.
 */
export async function saveDb() {
    if (!_db) return;
    const data = _db.export();
    await _idbSave(data);
}

// ── Schema ─────────────────────────────────────────────────────────────────────

function _applySchema(db) {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT    NOT NULL,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name             TEXT    NOT NULL,
            source_file_path TEXT,
            created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS theme (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id      INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
            primary_color   TEXT    NOT NULL DEFAULT '#be954e',
            secondary_color TEXT    NOT NULL DEFAULT '#2563eb',
            bg_color        TEXT    NOT NULL DEFAULT '#151518',
            text_color      TEXT    NOT NULL DEFAULT '#e7e5df',
            accent_color    TEXT    NOT NULL DEFAULT '#ff0000',
            font_family     TEXT    NOT NULL DEFAULT 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
        );

        CREATE TABLE IF NOT EXISTS sections (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            type       TEXT    NOT NULL,
            position   INTEGER NOT NULL DEFAULT 0,
            title      TEXT    NOT NULL DEFAULT '',
            visible    INTEGER NOT NULL DEFAULT 1,
            data_json  TEXT    NOT NULL DEFAULT '{}'
        );
    `);
}

// ── User helpers ───────────────────────────────────────────────────────────────

export function createUser(username, passwordHash) {
    if (!_db) throw new Error('DB not initialized');
    _db.run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username.trim(), passwordHash]
    );
    saveDb();
}

export function findUserByUsername(username) {
    if (!_db) throw new Error('DB not initialized');
    const stmt = _db.prepare(
        'SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE'
    );
    stmt.bind([username.trim()]);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
}

// ── Project helpers ────────────────────────────────────────────────────────────

export function createProject(userId, name) {
    if (!_db) throw new Error('DB not initialized');
    _db.run(
        'INSERT INTO projects (user_id, name) VALUES (?, ?)',
        [userId, name.trim()]
    );
    const res = _db.exec('SELECT last_insert_rowid() as id');
    const projectId = res[0].values[0][0];

    // Default theme
    _db.run('INSERT INTO theme (project_id) VALUES (?)', [projectId]);

    // Default sections in sensible order
    const defaults = [
        { type: 'header',      title: 'Header',           pos: 0 },
        { type: 'text',        title: 'Bio / About',      pos: 1 },
        { type: 'station',     title: 'Station Info',     pos: 2 },
        { type: 'map',         title: 'Ham Map',          pos: 3 },
        { type: 'youtube',     title: 'YouTube Videos',   pos: 4 },
        { type: 'gallery',     title: 'Gallery',        pos: 5 },
        { type: 'propagation', title: 'Propagation',      pos: 6 },
    ];
    for (const s of defaults) {
        _db.run(
            'INSERT INTO sections (project_id, type, position, title) VALUES (?, ?, ?, ?)',
            [projectId, s.type, s.pos, s.title]
        );
    }

    saveDb();
    return projectId;
}

export function getProjectsByUser(userId) {
    if (!_db) throw new Error('DB not initialized');
    const res = _db.exec(
        'SELECT id, name, source_file_path, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
        [userId]
    );
    if (!res.length) return [];
    const [cols, ...rows] = [res[0].columns, ...res[0].values];
    return rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

export function getProject(projectId) {
    if (!_db) throw new Error('DB not initialized');
    const res = _db.exec(
        'SELECT id, user_id, name, source_file_path, created_at, updated_at FROM projects WHERE id = ?',
        [projectId]
    );
    if (!res.length || !res[0].values.length) return null;
    const cols = res[0].columns;
    return Object.fromEntries(cols.map((c, i) => [c, res[0].values[0][i]]));
}

export function deleteProject(projectId) {
    if (!_db) throw new Error('DB not initialized');
    _db.run('DELETE FROM projects WHERE id = ?', [projectId]);
    saveDb();
}

export function renameProject(projectId, newName) {
    if (!_db) throw new Error('DB not initialized');
    _db.run(
        "UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?",
        [newName.trim(), projectId]
    );
    saveDb();
}

export function setProjectFilePath(projectId, filePath) {
    if (!_db) throw new Error('DB not initialized');
    _db.run(
        "UPDATE projects SET source_file_path = ?, updated_at = datetime('now') WHERE id = ?",
        [filePath, projectId]
    );
    saveDb();
}

export function touchProject(projectId) {
    if (!_db) throw new Error('DB not initialized');
    _db.run(
        "UPDATE projects SET updated_at = datetime('now') WHERE id = ?",
        [projectId]
    );
    saveDb();
}

// ── Theme helpers ──────────────────────────────────────────────────────────────

export function getTheme(projectId) {
    if (!_db) throw new Error('DB not initialized');
    const res = _db.exec(
        'SELECT * FROM theme WHERE project_id = ?',
        [projectId]
    );
    if (!res.length || !res[0].values.length) return null;
    const cols = res[0].columns;
    return Object.fromEntries(cols.map((c, i) => [c, res[0].values[0][i]]));
}

export function saveTheme(projectId, themeData) {
    if (!_db) throw new Error('DB not initialized');
    _db.run(
        `UPDATE theme SET
            primary_color   = ?,
            secondary_color = ?,
            bg_color        = ?,
            text_color      = ?,
            accent_color    = ?,
            font_family     = ?
         WHERE project_id = ?`,
        [
            themeData.primary_color,
            themeData.secondary_color,
            themeData.bg_color,
            themeData.text_color,
            themeData.accent_color,
            themeData.font_family,
            projectId
        ]
    );
    touchProject(projectId);
}

// ── Section helpers ────────────────────────────────────────────────────────────

export function getSections(projectId) {
    if (!_db) throw new Error('DB not initialized');
    const res = _db.exec(
        'SELECT id, type, position, title, visible, data_json FROM sections WHERE project_id = ? ORDER BY position ASC',
        [projectId]
    );
    if (!res.length) return [];
    const [cols, ...rows] = [res[0].columns, ...res[0].values];
    return rows.map(r => {
        const obj = Object.fromEntries(cols.map((c, i) => [c, r[i]]));
        try { obj.data = JSON.parse(obj.data_json); } catch { obj.data = {}; }
        return obj;
    });
}

export function getSection(sectionId) {
    if (!_db) throw new Error('DB not initialized');
    const res = _db.exec(
        'SELECT id, project_id, type, position, title, visible, data_json FROM sections WHERE id = ?',
        [sectionId]
    );
    if (!res.length || !res[0].values.length) return null;
    const cols = res[0].columns;
    const obj  = Object.fromEntries(cols.map((c, i) => [c, res[0].values[0][i]]));
    try { obj.data = JSON.parse(obj.data_json); } catch { obj.data = {}; }
    return obj;
}

export function addSection(projectId, type, title, data = {}) {
    if (!_db) throw new Error('DB not initialized');
    const maxRes = _db.exec(
        'SELECT COALESCE(MAX(position), -1) + 1 FROM sections WHERE project_id = ?',
        [projectId]
    );
    const nextPos = maxRes[0].values[0][0];
    _db.run(
        'INSERT INTO sections (project_id, type, position, title, visible, data_json) VALUES (?, ?, ?, ?, 1, ?)',
        [projectId, type, nextPos, title, JSON.stringify(data)]
    );
    const res = _db.exec('SELECT last_insert_rowid() as id');
    const id  = res[0].values[0][0];
    touchProject(projectId);
    return id;
}

export function updateSection(sectionId, title, data, visible) {
    if (!_db) throw new Error('DB not initialized');
    _db.run(
        'UPDATE sections SET title = ?, data_json = ?, visible = ? WHERE id = ?',
        [title, JSON.stringify(data), visible ? 1 : 0, sectionId]
    );
    // Touch parent project
    const res = _db.exec('SELECT project_id FROM sections WHERE id = ?', [sectionId]);
    if (res.length) touchProject(res[0].values[0][0]);
}

export function deleteSection(sectionId) {
    if (!_db) throw new Error('DB not initialized');
    const res = _db.exec('SELECT project_id FROM sections WHERE id = ?', [sectionId]);
    _db.run('DELETE FROM sections WHERE id = ?', [sectionId]);
    if (res.length) touchProject(res[0].values[0][0]);
    saveDb();
}

export function reorderSections(projectId, orderedIds) {
    if (!_db) throw new Error('DB not initialized');
    orderedIds.forEach((id, idx) => {
        _db.run('UPDATE sections SET position = ? WHERE id = ? AND project_id = ?',
                [idx, id, projectId]);
    });
    touchProject(projectId);
}

export function toggleSectionVisible(sectionId) {
    if (!_db) throw new Error('DB not initialized');
    _db.run('UPDATE sections SET visible = 1 - visible WHERE id = ?', [sectionId]);
    const res = _db.exec('SELECT project_id FROM sections WHERE id = ?', [sectionId]);
    if (res.length) touchProject(res[0].values[0][0]);
    saveDb();
}

// ── Bulk import (used by importer.js) ─────────────────────────────────────────

export function replaceSections(projectId, sectionsArray) {
    if (!_db) throw new Error('DB not initialized');
    _db.run('DELETE FROM sections WHERE project_id = ?', [projectId]);
    sectionsArray.forEach((s, idx) => {
        _db.run(
            'INSERT INTO sections (project_id, type, position, title, visible, data_json) VALUES (?, ?, ?, ?, ?, ?)',
            [projectId, s.type, idx, s.title || '', s.visible !== false ? 1 : 0, JSON.stringify(s.data || {})]
        );
    });
    touchProject(projectId);
}

export function replaceTheme(projectId, themeData) {
    saveTheme(projectId, themeData);
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

function _idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = e => {
            e.target.result.createObjectStore(IDB_STORE_NAME);
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
}

async function _idbLoad() {
    try {
        const idb = await _idbOpen();
        return new Promise((resolve, reject) => {
            const tx  = idb.transaction(IDB_STORE_NAME, 'readonly');
            const req = tx.objectStore(IDB_STORE_NAME).get(IDB_KEY);
            req.onsuccess = e => resolve(e.target.result || null);
            req.onerror   = e => reject(e.target.error);
        });
    } catch {
        return null;
    }
}

async function _idbSave(uint8Array) {
    const idb = await _idbOpen();
    return new Promise((resolve, reject) => {
        const tx  = idb.transaction(IDB_STORE_NAME, 'readwrite');
        const req = tx.objectStore(IDB_STORE_NAME).put(uint8Array, IDB_KEY);
        req.onsuccess = () => resolve();
        req.onerror   = e => reject(e.target.error);
    });
}
