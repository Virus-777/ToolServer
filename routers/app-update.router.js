'use strict';

const express = require('express');
const multer = require('multer');
const {
    getLatestRelease,
    downloadLatestRelease,
    downloadRelease,
    getAllReleases,
    getRelease,
    createRelease,
    updateRelease,
    deleteRelease,
} = require('../controllers/app-update.controller');
const { authenticateAdmin } = require('../utils/auth.middleware');
const { handleError } = require('../utils/utils');
const storage = require('../utils/app-update.storage');
const { APP_UPDATE } = require('../config/constants');

const router = express.Router();

// The release file is written straight to the updates directory under a
// temporary name; the controller renames it once the metadata is validated.
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            storage.ensureUpdatesDir().then((dir) => cb(null, dir)).catch(cb);
        },
        filename: (req, file, cb) => cb(null, storage.buildTempName()),
    }),
    limits: { fileSize: storage.getMaxFileSizeBytes(), files: 1, fields: 10 },
}).single(APP_UPDATE.FILE_FIELD);

/** Run multer and translate its errors into the usual `{ error }` responses. */
function uploadReleaseFile(req, res, next) {
    upload(req, res, (error) => {
        if (!error) {
            return next();
        }
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                const limitMb = Math.round(storage.getMaxFileSizeBytes() / (1024 * 1024));
                return handleError(res, 413, `Release file exceeds the ${limitMb} MB limit`);
            }
            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return handleError(res, 400, `Unexpected file field; send the file as "${APP_UPDATE.FILE_FIELD}"`);
            }
            return handleError(res, 400, error.message);
        }
        next(error);
    });
}

// Public: consumed by the RobustTailor client to check for and download updates
router.get('/latest', getLatestRelease);
router.get('/latest/download', downloadLatestRelease);
router.get('/:id/download', downloadRelease);

// Admin: release management from the dashboard
// (authentication runs before the multipart parser so anonymous uploads never touch the disk)
router.route('/')
    .get(authenticateAdmin, getAllReleases)
    .post(authenticateAdmin, uploadReleaseFile, createRelease);

router.route('/:id')
    .get(authenticateAdmin, getRelease)
    .put(authenticateAdmin, updateRelease)
    .delete(authenticateAdmin, deleteRelease);

module.exports = router;
