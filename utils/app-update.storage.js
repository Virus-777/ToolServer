'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { APP_UPDATE } = require('../config/constants');

/**
 * File storage for uploaded client application releases.
 *
 * Files are kept outside the code base (and outside the pkg snapshot, which is
 * read-only) in APP_UPDATES_DIR, defaulting to <cwd>/uploads/app-updates.
 */

exports.getUpdatesDir = () => {
    const configured = process.env.APP_UPDATES_DIR && process.env.APP_UPDATES_DIR.trim();
    return path.resolve(process.cwd(), configured || APP_UPDATE.DEFAULT_DIR);
};

exports.ensureUpdatesDir = async () => {
    const dir = exports.getUpdatesDir();
    await fsp.mkdir(dir, { recursive: true });
    return dir;
};

exports.getMaxFileSizeBytes = () => {
    const megabytes = Number(process.env.APP_UPDATE_MAX_FILE_SIZE_MB) || APP_UPDATE.DEFAULT_MAX_FILE_SIZE_MB;
    return megabytes * 1024 * 1024;
};

/** Temporary name used while the upload is being validated. */
exports.buildTempName = () => `upload-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.tmp`;

/**
 * Final on-disk name, e.g. "RobustTailor-1.2.0.exe". Only the (sanitised)
 * extension of the original file name is kept.
 */
exports.buildStoredName = (version, originalName) => {
    const extension = path.extname(originalName || '').toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 16);
    return `${APP_UPDATE.APP_NAME}-${version}${extension}`;
};

/** Keep the client-facing file name free of path separators and control characters. */
exports.sanitizeFileName = (name) => {
    // eslint-disable-next-line no-control-regex
    const base = path.basename(String(name || '')).replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim();
    return base || 'download';
};

exports.resolveStoredPath = (storedName) => path.join(exports.getUpdatesDir(), path.basename(storedName));

exports.fileExists = async (filePath) => {
    try {
        await fsp.access(filePath, fs.constants.R_OK);
        return true;
    } catch (error) {
        return false;
    }
};

/** Delete a file, ignoring the case where it is already gone. */
exports.removeFile = async (filePath) => {
    if (!filePath) {
        return;
    }
    try {
        await fsp.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Failed to remove file ${filePath}:`, error.message);
        }
    }
};

exports.hashFile = (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
        .on('error', reject)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => resolve(hash.digest('hex')));
});
