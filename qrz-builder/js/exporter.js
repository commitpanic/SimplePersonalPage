/**
 * exporter.js – Generate complete qrz_bio.html from project data
 *
 * Produces QRZ-ready HTML optimized for direct paste/upload.
 * Manager metadata comments are intentionally omitted from export.
 */

'use strict';

import { getSections, getTheme } from './db.js';
import { generateFullHtml }     from './templates/base-generator.js?v=20260711-2';

export function generateQrzBio(projectId, themeOverride = null) {
    const sections = getSections(projectId);
    const theme    = themeOverride || getTheme(projectId) || {};
    return generateFullHtml(sections, theme);
}
