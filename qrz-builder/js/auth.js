/**
 * auth.js – Registration, login (SHA-256 via Web Crypto API), session via sessionStorage
 */

'use strict';

import { createUser, findUserByUsername, saveDb } from './db.js';

const SESSION_KEY = 'qrz-builder-session';

// ── Password hashing ───────────────────────────────────────────────────────────

async function hashPassword(password) {
    const enc    = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ── Registration ───────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Returns { ok: true, userId, username } or { ok: false, error: string }
 */
export async function register(username, password) {
    username = username.trim();
    if (!username || username.length < 3) {
        return { ok: false, error: 'Username must be at least 3 characters.' };
    }
    if (!password || password.length < 6) {
        return { ok: false, error: 'Password must be at least 6 characters.' };
    }

    const existing = findUserByUsername(username);
    if (existing) {
        return { ok: false, error: 'Username already taken.' };
    }

    const hash = await hashPassword(password);
    try {
        createUser(username, hash);
        const user = findUserByUsername(username);
        return { ok: true, userId: user.id, username: user.username };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// ── Login ──────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user.
 * Returns { ok: true, userId, username } or { ok: false, error: string }
 */
export async function login(username, password) {
    username = username.trim();
    const user = findUserByUsername(username);
    if (!user) {
        return { ok: false, error: 'Invalid username or password.' };
    }

    const hash = await hashPassword(password);
    if (hash !== user.password_hash) {
        return { ok: false, error: 'Invalid username or password.' };
    }

    _setSession(user.id, user.username);
    return { ok: true, userId: user.id, username: user.username };
}

// ── Session ────────────────────────────────────────────────────────────────────

function _setSession(userId, username) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, username }));
}

export function getSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function logout() {
    sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Check if user is logged in; if not, redirect to index.html.
 * Returns session object { userId, username } if authenticated.
 */
export function requireAuth() {
    const session = getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}
