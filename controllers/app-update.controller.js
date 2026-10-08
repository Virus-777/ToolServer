'use strict';

const fsp = require('fs/promises');
const model = require('../database/model');
const storage = require('../utils/app-update.storage');
const { handleError, emptyToNull, parsePositiveInt } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { normalizeVersion, isValidVersion, compareVersions } = require('../utils/version.utils');
const { APP_UPDATE, HISTORY_ACTIONS, HISTORY_ENTITIES } = require('../config/constants');

/**
 * Releases of the RobustTailor client application.
 *
 * Public endpoints (used by the client's updater):
 *   GET /api/app-updates/latest            -> metadata of the newest release
 *   GET /api/app-updates/latest/download   -> file of the newest release
 *   GET /api/app-updates/:id/download      -> file of a specific release
 *
 * Admin endpoints (dashboard): list, upload (multipart), edit notes, delete.
 */

const APP_NAME = APP_UPDATE.APP_NAME;
const CHANGELOG_MAX_LENGTH = 20000;
const PG_UNIQUE_VIOLATION = '23505';

const parseBoolean = (value) => value === true || value === 'true' || value === '1' || value === 1 || value === 'on';

/** Absolute origin used for download links: PUBLIC_BASE_URL, else derived from the request. */
function getPublicBaseUrl(req) {
    const configured = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();
    if (configured) {
        return configured.replace(/\/+$/, '');
    }
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
    return `${protocol}://${req.get('host')}`;
}

const downloadPath = (row) => `/api/app-updates/${row.id}/download`;

/** Response shape shared by the dashboard and the client application. */
function serializeRelease(req, row) {
    return {
        id: row.id,
        app: row.app_name,
        version: row.version,
        changelog: row.changelog || '',
        mandatory: Boolean(row.mandatory),
        file_name: row.file_name,
        file_size: Number(row.file_size),
        sha256: row.sha256,
        download_path: downloadPath(row),
        download_url: `${getPublicBaseUrl(req)}${downloadPath(row)}`,
        download_count: row.download_count,
        published_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/** Stream a release file, counting the download once (not once per range request). */
async function sendReleaseFile(req, res, row) {
    const filePath = storage.resolveStoredPath(row.stored_name);
    if (!(await storage.fileExists(filePath))) {
        console.error(`Release file missing for version ${row.version}: ${filePath}`);
        return handleError(res, 404, 'Release file is missing on the server');
    }

    const range = req.headers.range;
    if (!range || /^bytes=0-/.test(range)) {
        model.incrementAppUpdateDownloads(row.id).catch((error) => {
            console.error('Failed to count download:', error.message);
        });
    }

    res.download(
        filePath,
        storage.sanitizeFileName(row.file_name),
        { headers: { 'Cache-Control': 'no-cache', 'X-Checksum-Sha256': row.sha256 } },
        (error) => {
            // Aborted transfers reach this callback too; only report when nothing was sent yet
            if (error && !res.headersSent) {
                console.error('Send release file error:', error);
                handleError(res, 500, 'Error sending release file');
            }
        }
    );
}

exports.getLatestRelease = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const current = normalizeVersion(req.query.current);
    if (current && !isValidVersion(current)) {
        return handleError(res, 400, 'Invalid current version (expected e.g. 1.2.0)');
    }

    try {
        const latest = await model.getLatestAppUpdate(APP_NAME);
        if (!latest) {
            return handleError(res, 404, 'No release has been published yet');
        }

        const release = serializeRelease(req, latest);
        if (current) {
            // Lets the client send its own version and get a ready-made answer
            release.current_version = current;
            release.update_available = compareVersions(latest.version, current) > 0;
        }

        res.status(200).json(release);
    } catch (error) {
        console.error('Get latest release error:', error);
        handleError(res, 500, 'Error fetching latest release');
    }
};

exports.downloadLatestRelease = async (req, res) => {
    try {
        const latest = await model.getLatestAppUpdate(APP_NAME);
        if (!latest) {
            return handleError(res, 404, 'No release has been published yet');
        }
        await sendReleaseFile(req, res, latest);
    } catch (error) {
        console.error('Download latest release error:', error);
        handleError(res, 500, 'Error downloading release');
    }
};

exports.downloadRelease = async (req, res) => {
    const id = parsePositiveInt(req.params.id, null);
    if (!id) {
        return handleError(res, 400, 'Invalid release id');
    }

    try {
        const release = await model.getAppUpdateById(id);
        if (!release) {
            return handleError(res, 404, 'Release not found');
        }
        await sendReleaseFile(req, res, release);
    } catch (error) {
        console.error('Download release error:', error);
        handleError(res, 500, 'Error downloading release');
    }
};

exports.getAllReleases = async (req, res) => {
    try {
        const releases = await model.getAppUpdates(APP_NAME);
        res.status(200).json({
            app: APP_NAME,
            updates: releases.map((row) => serializeRelease(req, row)),
        });
    } catch (error) {
        console.error('Get all releases error:', error);
        handleError(res, 500, 'Error fetching releases');
    }
};

exports.getRelease = async (req, res) => {
    const id = parsePositiveInt(req.params.id, null);
    if (!id) {
        return handleError(res, 400, 'Invalid release id');
    }

    try {
        const release = await model.getAppUpdateById(id);
        if (!release) {
            return handleError(res, 404, 'Release not found');
        }
        res.status(200).json({ update: serializeRelease(req, release) });
    } catch (error) {
        console.error('Get release error:', error);
        handleError(res, 500, 'Error fetching release');
    }
};

/**
 * multipart/form-data: `file` (the installer / archive), `version`, optional
 * `changelog` and `mandatory`. The upload middleware has already written the
 * file to a temporary name inside the updates directory.
 */
exports.createRelease = async (req, res) => {
    const file = req.file;
    const discardUpload = () => storage.removeFile(file && file.path);

    if (!file) {
        return handleError(res, 400, `Release file is required (multipart field "${APP_UPDATE.FILE_FIELD}")`);
    }

    const version = normalizeVersion(req.body.version);
    const changelog = emptyToNull(req.body.changelog);
    const mandatory = parseBoolean(req.body.mandatory);

    let validationError = null;
    if (!version) {
        validationError = 'Version is required';
    } else if (!isValidVersion(version)) {
        validationError = 'Version must be 2 to 4 numeric segments separated by dots, e.g. 1.2.0';
    } else if (changelog && changelog.length > CHANGELOG_MAX_LENGTH) {
        validationError = `Change log must be at most ${CHANGELOG_MAX_LENGTH} characters`;
    } else if (!file.size) {
        validationError = 'Release file is empty';
    }
    if (validationError) {
        await discardUpload();
        return handleError(res, 400, validationError);
    }

    let finalPath = null;
    try {
        if (await model.getAppUpdateByVersion(APP_NAME, version)) {
            await discardUpload();
            return handleError(res, 409, `Version ${version} already exists`);
        }

        // Move the validated upload to its final name (same directory, so this is a rename)
        const storedName = storage.buildStoredName(version, file.originalname);
        finalPath = storage.resolveStoredPath(storedName);
        await fsp.rename(file.path, finalPath);
        const sha256 = await storage.hashFile(finalPath);

        const release = await model.createAppUpdate({
            appName: APP_NAME,
            version,
            changelog,
            fileName: storage.sanitizeFileName(file.originalname),
            storedName,
            fileSize: file.size,
            sha256,
            mandatory,
        });

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.APP_UPDATE,
            entityId: release.id,
            description: `${APP_NAME} ${version} uploaded (${release.file_name})`,
            metadata: { version, file_name: release.file_name, file_size: file.size, sha256, mandatory },
        });

        res.status(201).json({
            message: `Version ${version} uploaded successfully`,
            update: serializeRelease(req, release),
        });
    } catch (error) {
        await discardUpload();
        await storage.removeFile(finalPath);

        if (error.code === PG_UNIQUE_VIOLATION) {
            return handleError(res, 409, `Version ${version} already exists`);
        }
        console.error('Create release error:', error);
        handleError(res, 500, 'Error uploading release');
    }
};

/** Only the change log and the mandatory flag can change; upload a new version for a new file. */
exports.updateRelease = async (req, res) => {
    const id = parsePositiveInt(req.params.id, null);
    if (!id) {
        return handleError(res, 400, 'Invalid release id');
    }

    const hasChangelog = req.body.changelog !== undefined;
    const changelog = hasChangelog ? emptyToNull(req.body.changelog) : undefined;
    if (changelog && changelog.length > CHANGELOG_MAX_LENGTH) {
        return handleError(res, 400, `Change log must be at most ${CHANGELOG_MAX_LENGTH} characters`);
    }

    try {
        const existing = await model.getAppUpdateById(id);
        if (!existing) {
            return handleError(res, 404, 'Release not found');
        }

        const updated = await model.updateAppUpdate(id, {
            changelog: hasChangelog ? changelog : existing.changelog,
            mandatory: req.body.mandatory !== undefined ? parseBoolean(req.body.mandatory) : existing.mandatory,
        });

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.APP_UPDATE,
            entityId: id,
            description: `${APP_NAME} ${existing.version} release notes updated`,
            metadata: { version: existing.version, mandatory: updated.mandatory },
        });

        res.status(200).json({
            message: `Version ${existing.version} updated successfully`,
            update: serializeRelease(req, updated),
        });
    } catch (error) {
        console.error('Update release error:', error);
        handleError(res, 500, 'Error updating release');
    }
};

exports.deleteRelease = async (req, res) => {
    const id = parsePositiveInt(req.params.id, null);
    if (!id) {
        return handleError(res, 400, 'Invalid release id');
    }

    try {
        const existing = await model.getAppUpdateById(id);
        if (!existing) {
            return handleError(res, 404, 'Release not found');
        }

        await model.deleteAppUpdate(id);
        await storage.removeFile(storage.resolveStoredPath(existing.stored_name));

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.APP_UPDATE,
            entityId: id,
            description: `${APP_NAME} ${existing.version} deleted`,
            metadata: { version: existing.version, file_name: existing.file_name },
        });

        res.status(200).json({ message: `Version ${existing.version} deleted successfully` });
    } catch (error) {
        console.error('Delete release error:', error);
        handleError(res, 500, 'Error deleting release');
    }
};
