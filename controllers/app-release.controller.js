'use strict';

const fsp = require('fs/promises');
const semver = require('semver');
const model = require('../database/model');
const storage = require('../utils/release.storage');
const { handleError, emptyToNull, parsePositiveInt } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { APP_RELEASE, HISTORY_ACTIONS, HISTORY_ENTITIES } = require('../config/constants');

/**
 * Online updates for the RobustTailor desktop app (Tauri 2, tauri-plugin-updater).
 *
 * Public (no auth, used by the installed app):
 *   GET /api/app/update/:target/:arch/:currentVersion  -> 204 or the updater manifest
 *   GET /releases/:filename                            -> the signed NSIS installer
 *
 * Admin (dashboard):
 *   GET/POST /api/admin/app/releases, PATCH/DELETE /api/admin/app/releases/:id
 */

const NOTES_MAX_LENGTH = 4000;
const SIGNATURE_PREFIX = 'untrusted comment:';
const SIGNATURE_MAX_BYTES = 64 * 1024;
const PG_UNIQUE_VIOLATION = '23505';

// Full RFC 3339 timestamp: date, time and zone are all required (a bare date breaks the client)
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const parseBoolean = (value) => value === true || value === 'true' || value === '1' || value === 1 || value === 'on';

/**
 * multipart/form-data encodes newlines in *text fields* as CRLF (browsers and
 * fetch do this), so undo that for pasted notes / signatures. A CR inside the
 * base64 line of a signature would break minisign parsing in the client.
 * Signature *files* are read as uploaded and never touched.
 */
const normalizeNewlines = (value) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value);

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for the tests)                                */
/* ------------------------------------------------------------------ */

const isSupportedPlatform = (target, arch) =>
    APP_RELEASE.TARGETS.includes(target) && Object.prototype.hasOwnProperty.call(APP_RELEASE.ARCH_SUFFIX, arch);

/**
 * Version reported by the running app: tolerate a leading "v" and strip build
 * metadata ("2.0.0+abc" -> "2.0.0"). Returns the normalised semver or null.
 */
const parseCurrentVersion = (raw) => {
    if (typeof raw !== 'string') {
        return null;
    }
    const withoutBuild = raw.trim().replace(/^v/i, '').split('+')[0];
    return semver.valid(withoutBuild);
};

/** Newest published release that is strictly newer than `currentVersion`, or null. */
const pickUpdate = (releases, currentVersion) => {
    const candidates = releases.filter(
        (release) => release.published && semver.valid(release.version) && semver.gt(release.version, currentVersion)
    );
    if (candidates.length === 0) {
        return null;
    }
    return candidates.sort((a, b) => semver.rcompare(a.version, b.version))[0];
};

/** RFC 3339 without fractional seconds, e.g. "2026-11-02T09:30:00Z". */
const formatPubDate = (value) => {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

const platformKey = (release) => `${release.target}-${release.arch}`;

/** Absolute origin for installer URLs: PUBLIC_BASE_URL, else derived from the request. */
function getPublicBaseUrl(req) {
    const configured = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();
    if (configured) {
        return configured.replace(/\/+$/, '');
    }
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
    return `${protocol}://${req.get('host')}`;
}

const artifactUrl = (baseUrl, release) => `${baseUrl}/releases/${encodeURIComponent(release.file_name)}`;

/** The exact document tauri-plugin-updater expects. */
const buildManifest = (release, baseUrl) => {
    const manifest = { version: release.version };
    if (release.notes) {
        manifest.notes = release.notes;
    }
    const pubDate = formatPubDate(release.pub_date);
    if (pubDate) {
        manifest.pub_date = pubDate;
    }
    manifest.platforms = {
        [platformKey(release)]: {
            signature: release.signature,
            url: artifactUrl(baseUrl, release),
        },
    };
    return manifest;
};

/** Admin representation: the record without the signature body. */
function serializeRelease(req, release) {
    return {
        id: release.id,
        version: release.version,
        notes: release.notes,
        pub_date: formatPubDate(release.pub_date),
        target: release.target,
        arch: release.arch,
        platform: platformKey(release),
        file_name: release.file_name,
        url: artifactUrl(getPublicBaseUrl(req), release),
        sha256: release.sha256,
        size: Number(release.size),
        published: Boolean(release.published),
        created_at: release.created_at,
        updated_at: release.updated_at,
    };
}

/* ------------------------------------------------------------------ */
/* Public endpoints                                                     */
/* ------------------------------------------------------------------ */

exports.checkForUpdate = async (req, res) => {
    const { target, arch } = req.params;
    const currentVersion = parseCurrentVersion(req.params.currentVersion);
    if (!currentVersion) {
        return handleError(res, 400, 'invalid version');
    }
    if (!isSupportedPlatform(target, arch)) {
        return res.status(204).end();
    }

    try {
        const releases = await model.getPublishedAppReleases(target, arch);
        const update = pickUpdate(releases, currentVersion);
        if (!update) {
            return res.status(204).end();
        }

        res.set('Cache-Control', 'no-cache');
        res.status(200).json(buildManifest(update, getPublicBaseUrl(req)));
    } catch (error) {
        console.error('Check for update error:', error);
        handleError(res, 500, 'Error checking for updates');
    }
};

/** Static installer download: streamed, immutable, with Content-Length for the progress bar. */
exports.serveArtifact = async (req, res) => {
    const fileName = req.params.filename;
    if (!storage.isInstallerName(fileName)) {
        return handleError(res, 404, 'Not found');
    }

    const filePath = storage.resolveReleasePath(fileName);
    if (!(await storage.fileExists(filePath))) {
        return handleError(res, 404, 'Not found');
    }

    res.sendFile(
        filePath,
        {
            dotfiles: 'deny',
            acceptRanges: true,
            cacheControl: false,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        },
        (error) => {
            // Aborted transfers reach this callback too; only report when nothing was sent yet
            if (error && !res.headersSent) {
                console.error('Serve artifact error:', error);
                handleError(res, 500, 'Error sending installer');
            }
        }
    );
};

/* ------------------------------------------------------------------ */
/* Admin endpoints                                                      */
/* ------------------------------------------------------------------ */

exports.listReleases = async (req, res) => {
    try {
        const releases = await model.getAppReleases();
        // Newest version first (semver), then newest upload
        releases.sort((a, b) => {
            const byVersion = semver.valid(a.version) && semver.valid(b.version) ? semver.rcompare(a.version, b.version) : 0;
            return byVersion !== 0 ? byVersion : new Date(b.created_at) - new Date(a.created_at);
        });
        res.status(200).json({ releases: releases.map((release) => serializeRelease(req, release)) });
    } catch (error) {
        console.error('List releases error:', error);
        handleError(res, 500, 'Error fetching releases');
    }
};

/**
 * multipart/form-data: installer (file), signature (.sig file or text field),
 * version, optional notes / pub_date / target / arch / published.
 * The upload middleware has written the files to temporary names in RELEASES_DIR.
 */
exports.createRelease = async (req, res) => {
    const installer = req.files && req.files.installer ? req.files.installer[0] : null;
    const signatureFile = req.files && req.files.signature ? req.files.signature[0] : null;
    const discardUploads = () => Promise.all([
        storage.removeFile(installer && installer.path),
        storage.removeFile(signatureFile && signatureFile.path),
    ]);

    const fail = async (status, message) => {
        await discardUploads();
        return handleError(res, status, message);
    };

    try {
        const version = semver.valid(String(req.body.version || '').trim().replace(/^v/i, ''));
        if (!version) {
            return await fail(400, 'Version must be a valid semver string, e.g. 2.1.0');
        }

        const target = String(req.body.target || APP_RELEASE.DEFAULT_TARGET).trim().toLowerCase();
        const arch = String(req.body.arch || APP_RELEASE.DEFAULT_ARCH).trim().toLowerCase();
        if (!isSupportedPlatform(target, arch)) {
            return await fail(400, `Unsupported target/arch (supported: ${APP_RELEASE.TARGETS.join(', ')} / ${Object.keys(APP_RELEASE.ARCH_SUFFIX).join(', ')})`);
        }

        const notes = emptyToNull(normalizeNewlines(req.body.notes));
        if (notes && notes.length > NOTES_MAX_LENGTH) {
            return await fail(400, `Notes must be at most ${NOTES_MAX_LENGTH} characters`);
        }

        const pubDateInput = emptyToNull(req.body.pub_date);
        let pubDate = null;
        if (pubDateInput) {
            const trimmed = pubDateInput.trim();
            if (!RFC3339_PATTERN.test(trimmed) || Number.isNaN(new Date(trimmed).getTime())) {
                return await fail(400, 'pub_date must be a full RFC 3339 timestamp with time and zone, e.g. 2026-11-02T09:30:00Z');
            }
            pubDate = new Date(trimmed);
        }

        if (!installer) {
            return await fail(400, 'Installer file is required (multipart field "installer")');
        }
        const expectedName = storage.buildInstallerName(version, arch);
        if (installer.originalname !== expectedName) {
            return await fail(400, `Installer file name must be ${expectedName}`);
        }
        if (installer.size < APP_RELEASE.MIN_INSTALLER_BYTES) {
            return await fail(400, 'Installer is too small to be a valid build (minimum 1 MB)');
        }

        let signature = null;
        if (signatureFile) {
            signature = await storage.readSmallTextFile(signatureFile.path, SIGNATURE_MAX_BYTES);
            if (signature === null) {
                return await fail(400, 'Signature file is too large');
            }
        } else if (typeof req.body.signature === 'string') {
            signature = normalizeNewlines(req.body.signature);
        }
        if (!signature || !signature.startsWith(SIGNATURE_PREFIX)) {
            return await fail(400, `Signature is required and must start with "${SIGNATURE_PREFIX}" (the full .sig file content)`);
        }

        const published = req.body.published === undefined ? true : parseBoolean(req.body.published);

        if (await model.getAppReleaseByVersion(target, arch, version)) {
            return await fail(409, `Version ${version} already exists for ${target}-${arch}`);
        }

        // Move the validated installer to its final name (same directory, so this is a rename)
        const finalPath = storage.resolveReleasePath(expectedName);
        await fsp.rename(installer.path, finalPath);
        await storage.removeFile(signatureFile && signatureFile.path);

        let release;
        try {
            const sha256 = await storage.hashFile(finalPath);
            release = await model.createAppRelease({
                version,
                notes,
                pubDate,
                target,
                arch,
                fileName: expectedName,
                signature, // stored as received (file content verbatim), never trimmed
                sha256,
                size: installer.size,
                published,
            });
        } catch (error) {
            await storage.removeFile(finalPath);
            if (error.code === PG_UNIQUE_VIOLATION) {
                return handleError(res, 409, `Version ${version} already exists for ${target}-${arch}`);
            }
            throw error;
        }

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.APP_RELEASE,
            entityId: release.id,
            description: `${APP_RELEASE.APP_NAME} ${version} (${target}-${arch}) published`,
            metadata: { version, target, arch, file_name: expectedName, size: installer.size, sha256: release.sha256, published },
        });

        res.status(201).json({
            message: `Version ${version} uploaded successfully`,
            release: serializeRelease(req, release),
        });
    } catch (error) {
        await discardUploads();
        console.error('Create release error:', error);
        handleError(res, 500, 'Error uploading release');
    }
};

/** PATCH { published?: boolean, notes?: string } */
exports.patchRelease = async (req, res) => {
    const id = parsePositiveInt(req.params.id, null);
    if (!id) {
        return handleError(res, 400, 'Invalid release id');
    }

    const body = req.body || {};
    if (body.published !== undefined && typeof body.published !== 'boolean') {
        return handleError(res, 400, 'published must be a boolean');
    }
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
        return handleError(res, 400, 'notes must be a string');
    }
    const notes = body.notes !== undefined ? emptyToNull(normalizeNewlines(body.notes)) : undefined;
    if (notes && notes.length > NOTES_MAX_LENGTH) {
        return handleError(res, 400, `Notes must be at most ${NOTES_MAX_LENGTH} characters`);
    }
    if (body.published === undefined && notes === undefined) {
        return handleError(res, 400, 'Nothing to update: send published and/or notes');
    }

    try {
        const existing = await model.getAppReleaseById(id);
        if (!existing) {
            return handleError(res, 404, 'Release not found');
        }

        const updated = await model.updateAppRelease(id, {
            published: body.published !== undefined ? body.published : existing.published,
            notes: notes !== undefined ? notes : existing.notes,
        });

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.APP_RELEASE,
            entityId: id,
            description: `${APP_RELEASE.APP_NAME} ${existing.version} ${body.published !== undefined ? (updated.published ? 'published' : 'unpublished') : 'notes updated'}`,
            metadata: { version: existing.version, published: updated.published },
        });

        res.status(200).json({
            message: `Version ${existing.version} updated successfully`,
            release: serializeRelease(req, updated),
        });
    } catch (error) {
        console.error('Patch release error:', error);
        handleError(res, 500, 'Error updating release');
    }
};

/** Only unpublished releases can be deleted; published artifacts stay available forever. */
exports.deleteRelease = async (req, res) => {
    const id = parsePositiveInt(req.params.id, null);
    if (!id) {
        return handleError(res, 400, 'Invalid release id');
    }

    try {
        const existing = await model.getAppReleaseById(id);
        if (!existing) {
            return handleError(res, 404, 'Release not found');
        }
        if (existing.published) {
            return handleError(res, 409, 'Unpublish the release before deleting it');
        }

        await model.deleteAppRelease(id);
        await storage.removeFile(storage.resolveReleasePath(existing.file_name));

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.APP_RELEASE,
            entityId: id,
            description: `${APP_RELEASE.APP_NAME} ${existing.version} deleted`,
            metadata: { version: existing.version, file_name: existing.file_name },
        });

        res.status(200).json({ message: `Version ${existing.version} deleted successfully` });
    } catch (error) {
        console.error('Delete release error:', error);
        handleError(res, 500, 'Error deleting release');
    }
};

// Exposed for unit tests
exports._internal = { parseCurrentVersion, pickUpdate, buildManifest, formatPubDate, isSupportedPlatform, RFC3339_PATTERN };
