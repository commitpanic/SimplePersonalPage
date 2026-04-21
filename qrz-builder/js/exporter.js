/**
 * exporter.js – Generate complete qrz_bio.html from project data
 *
 * Produces the same format as the original qrz_bio.html with:
 * - GAL-MANAGER-START/END markers
 * - GAL-DATA: JSON comment
 * - YT-MANAGER-START/END markers
 * - YT-DATA: JSON comment
 */

'use strict';

import { getSections, getTheme } from './db.js';
import { generateFullHtml }     from './templates/base-generator.js';

export function generateQrzBio(projectId) {
    const sections = getSections(projectId);
    const theme    = getTheme(projectId) || {};
    return generateFullHtml(sections, theme);
}
