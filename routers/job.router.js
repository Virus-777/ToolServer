const express = require('express');
const { getJobs, getTodayJobs, getJob, createJob, updateJob, deleteJob, deleteJobsByDate } = require('../controllers/job.controller');
const { authenticateJobsApi } = require('../utils/auth.middleware');
const router = express.Router();

// Reading the job list requires an API token generated on the dashboard
// (API Tokens page) or an admin session. The other routes are unchanged (public).
router.route('/')
    .get(authenticateJobsApi, getJobs)
    .post(createJob);

// External API endpoint for today's jobs
router.route('/today')
    .get(authenticateJobsApi, getTodayJobs);

// Delete all jobs for a given date (?date=YYYY-MM-DD)
router.route('/by-date')
    .delete(deleteJobsByDate);

router.route('/:id')
    .get(getJob)
    .put(updateJob)
    .delete(deleteJob);

module.exports = router;
