/**
 * fileops.js – File System Access API wrapper (open/save qrz_bio.html)
 */

'use strict';

const FILE_TYPES = [{
    description: 'HTML Files',
    accept: { 'text/html': ['.html', '.htm'] }
}];

/**
 * Open a file picker and return { handle, name, text } or null on abort.
 */
export async function openHtmlFile() {
    if (!window.showOpenFilePicker) {
        throw new Error('File System Access API not supported. Please use Chrome or Edge.');
    }
    try {
        const [handle] = await window.showOpenFilePicker({
            types: FILE_TYPES,
            multiple: false
        });
        const file = await handle.getFile();
        const text = await file.text();
        return { handle, name: file.name, text };
    } catch (e) {
        if (e.name === 'AbortError') return null;
        throw e;
    }
}

/**
 * Write text to an existing file handle (requires user permission).
 */
export async function writeToHandle(handle, text) {
    let writable;
    try {
        writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
    } catch (e) {
        if (writable) { try { await writable.abort(); } catch {} }
        if (e.name === 'NotAllowedError') {
            throw new Error('Permission denied. Re-open the file to grant write access.');
        }
        throw e;
    }
}

/**
 * Save a new file via Save As picker. Returns the new handle or null on abort.
 */
export async function saveAsHtmlFile(text, suggestedName = 'qrz_bio.html') {
    if (!window.showSaveFilePicker) {
        throw new Error('File System Access API not supported. Please use Chrome or Edge.');
    }
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName,
            types: FILE_TYPES
        });
        await writeToHandle(handle, text);
        return handle;
    } catch (e) {
        if (e.name === 'AbortError') return null;
        throw e;
    }
}

/**
 * Check if File System Access API is available.
 */
export function isFileApiSupported() {
    return !!window.showOpenFilePicker;
}
