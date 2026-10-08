'use strict';

const express = require('express');
const multer = require('multer');
const {
    checkForUpdate,
    serveArtifact,
    listReleases,
    createRelease,
    patchRelease,
    deleteRelease,
} = require('../controllers/app-release.controller');
const { authenticateAdmin } = require('../utils/auth.middleware');
const { handleError } = require('../utils/utils');
const storage = require('../utils/release.storage');

/**
 * Three small routers for the RobustTailor updater, mounted in app.js:
 *   updateRouter   -> /api/app            (GET /update/:target/:arch/:currentVersion, public)
 *   artifactRouter -> /releases           (GET /:filename, public)
 *   adminRouter    -> /api/admin/app/releases (admin only)
 */

// Uploads are written straight to RELEASES_DIR under temporary names; the
// controller renames the installer once the metadata is validated.
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            storage.ensureReleasesDir().then((dir) => cb(null, dir)).catch(cb);
        },
        filename: (req, file, cb) => cb(null, storage.buildTempName()),
    }),
    limits: { fileSize: storage.getMaxFileSizeBytes(), files: 2, fields: 20 },
}).fields([
    { name: 'installer', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
]);

/** Run multer and translate its errors into the usual `{ error }` responses. */
function uploadReleaseFiles(req, res, next) {
    upload(req, res, (error) => {
        if (!error) {
            return next();
        }
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                const limitMb = Math.round(storage.getMaxFileSizeBytes() / (1024 * 1024));
                return handleError(res, 413, `Installer exceeds the ${limitMb} MB limit`);
            }
            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return handleError(res, 400, 'Unexpected file field; send "installer" and optionally "signature"');
            }
            return handleError(res, 400, error.message);
        }
        next(error);
    });
}

const updateRouter = express.Router();
updateRouter.get('/update/:target/:arch/:currentVersion', checkForUpdate);

const artifactRouter = express.Router();
artifactRouter.get('/:filename', serveArtifact);

// Authentication runs before the multipart parser so anonymous uploads never touch the disk
const adminRouter = express.Router();
adminRouter.route('/')
    .get(authenticateAdmin, listReleases)
    .post(authenticateAdmin, uploadReleaseFiles, createRelease);
adminRouter.route('/:id')
    .patch(authenticateAdmin, patchRelease)
    .delete(authenticateAdmin, deleteRelease);

module.exports = { updateRouter, artifactRouter, adminRouter };
