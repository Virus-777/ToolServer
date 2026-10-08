'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { APP_RELEASE } = require('../config/constants');

/**
 * On-disk storage for RobustTailor installers served by GET /releases/:filename.
 *
 * Files live outside the web root in RELEASES_DIR (default <cwd>/releases, so
 * it also works next to the pkg executable) and are always streamed.
 */

// Installer names written by the Tauri bundler: RobustTailor_<version>_x64-setup.exe
const INSTALLER_NAME_PATTERN = /^RobustTailor_[0-9A-Za-z.+-]{1,64}_(x64|arm64)-setup\.exe$/;

exports.INSTALLER_NAME_PATTERN = INSTALLER_NAME_PATTERN;

exports.isInstallerName = (name) => typeof name === 'string' && INSTALLER_NAME_PATTERN.test(name);

/** Expected installer file name for a version / arch pair. */
exports.buildInstallerName = (version, arch) =>
    `${APP_RELEASE.APP_NAME}_${version}_${APP_RELEASE.ARCH_SUFFIX[arch]}-setup.exe`;

exports.getReleasesDir = () => {
    const configured = process.env.RELEASES_DIR && process.env.RELEASES_DIR.trim();
    return path.resolve(process.cwd(), configured || APP_RELEASE.DEFAULT_DIR);
};

exports.ensureReleasesDir = async () => {
    const dir = exports.getReleasesDir();
    await fsp.mkdir(dir, { recursive: true });
    return dir;
};

exports.getMaxFileSizeBytes = () => {
    const megabytes = Number(process.env.APP_RELEASE_MAX_FILE_SIZE_MB) || APP_RELEASE.DEFAULT_MAX_FILE_SIZE_MB;
    return megabytes * 1024 * 1024;
};

/** Temporary name used while an upload is being validated. */
exports.buildTempName = () => `upload-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.tmp`;

/** Absolute path of a stored installer; `basename` keeps it inside the releases directory. */
exports.resolveReleasePath = (fileName) => path.join(exports.getReleasesDir(), path.basename(fileName));

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

/** Read a small text file (the .sig), refusing anything above `maxBytes`. */
exports.readSmallTextFile = async (filePath, maxBytes) => {
    const stat = await fsp.stat(filePath);
    if (stat.size > maxBytes) {
        return null;
    }
    return fsp.readFile(filePath, 'utf8');
};

exports.hashFile = (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
        .on('error', reject)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => resolve(hash.digest('hex')));
});
