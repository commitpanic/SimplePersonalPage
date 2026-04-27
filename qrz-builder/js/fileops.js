/**
 * fileops.js – File System Access API wrapper (open/save qrz_bio.html)
 *
 * Falls back to <input type="file"> / Blob download for Firefox and other
 * browsers that don't support the File System Access API.
 */

'use strict';

const FILE_TYPES = [{
    description: 'HTML Files',
    accept: { 'text/html': ['.html', '.htm'] }
}];

/**
 * Check if File System Access API is available.
 */
export function isFileApiSupported() {
    return !!window.showOpenFilePicker;
}

/**
 * Open a file picker and return { handle, name, text } or null on abort.
 * Falls back to a hidden <input type="file"> when the API is unavailable (Firefox).
 */
export async function openHtmlFile() {
    if (window.showOpenFilePicker) {
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

    // Fallback: classic <input type="file"> (Firefox, Safari, etc.)
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm';

        // Detect cancel: focus returns to the window without a file being chosen
        const onFocus = () => {
            setTimeout(() => {
                if (!input.files || !input.files.length) resolve(null);
            }, 400);
        };
        window.addEventListener('focus', onFocus, { once: true });

        input.onchange = async () => {
            window.removeEventListener('focus', onFocus);
            const file = input.files[0];
            if (!file) { resolve(null); return; }
            try {
                const text = await file.text();
                // handle is null – write-back not available without File System Access API
                resolve({ handle: null, name: file.name, text });
            } catch (e) {
                reject(e);
            }
        };

        input.click();
    });
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
 * Falls back to a Blob download when the API is unavailable (Firefox).
 */
export async function saveAsHtmlFile(text, suggestedName = 'qrz_bio.html') {
    if (window.showSaveFilePicker) {
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

    // Fallback: trigger a Blob download (Firefox, Safari, etc.)
    const blob = new Blob([text], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // No writable handle available via download – return null
    return null;
}
