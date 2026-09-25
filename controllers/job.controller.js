'use strict';

const model = require('../database/model');
const { handleError, parsePagination, isValidUrl, emptyToNull } = require('../utils/utils');
const { isIsoDate, todayInTimeZone } = require('../utils/date.utils');
const { logHistory } = require('../utils/history');
const { INDUSTRY, INDUSTRY_VALUES, HISTORY_ACTIONS, HISTORY_ENTITIES, PAGINATION, JOBS_TIME_ZONE } = require('../config/constants');

const INVALID_INDUSTRY_MESSAGE = 'Invalid industry. Expected 0 (software) or 1 (civil)';

const isBlank = (value) => value === undefined || value === null || value === '';

/** Normalised industry value, or null when it is not a valid category. */
const parseIndustry = (value) => {
    if (isBlank(value)) {
        return null;
    }
    const parsed = parseInt(value, 10);
    return INDUSTRY_VALUES.includes(parsed) ? parsed : null;
};

/** Pick and normalise the writable job fields from a request body. */
const readJobFields = (body) => ({
    title: body.title,
    company: body.company,
    date: body.date,
    tech: body.tech,
    url: body.url,
    summary: emptyToNull(body.summary),
    description: body.description,
});

exports.getJobs = async (req, res) => {
    try {
        const { date, search, orderDirection = 'ASC', industry } = req.query;
        const { page, limit } = parsePagination(req.query, {
            defaultLimit: PAGINATION.JOBS_DEFAULT_LIMIT,
            maxLimit: PAGINATION.MAX_LIMIT,
        });

        const result = await model.getJobs({
            date,
            page,
            limit,
            search,
            orderDirection,
            industry: parseIndustry(industry),
        });

        res.status(200).json({
            jobs: result.jobs,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get jobs error:', error);
        handleError(res, 500, 'Error fetching jobs');
    }
};

exports.getTodayJobs = async (req, res) => {
    try {
        const isoDate = todayInTimeZone(JOBS_TIME_ZONE);
        const jobs = await model.getJobsByDate(isoDate, parseIndustry(req.query.industry));

        res.status(200).json({
            date: isoDate,
            jobs,
            count: jobs.length,
        });
    } catch (error) {
        console.error('Get today jobs error:', error);
        handleError(res, 500, "Error fetching today's jobs");
    }
};

exports.getJob = async (req, res) => {
    const { id } = req.params;

    try {
        const job = await model.getJobById(id);
        if (!job) {
            return handleError(res, 404, 'Job not found');
        }

        res.status(200).json({ job });
    } catch (error) {
        console.error('Get job error:', error);
        handleError(res, 500, 'Error fetching job');
    }
};

exports.createJob = async (req, res) => {
    const fields = readJobFields(req.body);
    const { industry } = req.body;

    if (!fields.title || !fields.company || !fields.date) {
        return handleError(res, 400, 'Title, company and date are required');
    }

    // Industry defaults to software when omitted
    if (!isBlank(industry) && parseIndustry(industry) === null) {
        return handleError(res, 400, INVALID_INDUSTRY_MESSAGE);
    }
    const jobIndustry = parseIndustry(industry) ?? INDUSTRY.SOFTWARE;

    if (fields.url && !isValidUrl(fields.url)) {
        return handleError(res, 400, 'Invalid URL format');
    }

    try {
        if (await model.isBlocked(fields.company, fields.url)) {
            return handleError(res, 403, 'This job is blocked. Company name or URL is in the block list.');
        }

        const newJob = await model.createJob({ ...fields, industry: jobIndustry });

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.JOB,
            entityId: newJob.id,
            description: `Job created: ${fields.title} at ${fields.company}`,
            metadata: { job_id: newJob.id, company: fields.company, url: fields.url, industry: jobIndustry },
        });

        res.status(201).json({
            message: 'Job created successfully',
            job: newJob,
        });
    } catch (error) {
        console.error('Create job error:', error);
        handleError(res, 500, 'Error creating job');
    }
};

exports.updateJob = async (req, res) => {
    const { id } = req.params;
    const fields = readJobFields(req.body);
    const { industry } = req.body;

    try {
        const existingJob = await model.getJobById(id);
        if (!existingJob) {
            return handleError(res, 404, 'Job not found');
        }

        if (!fields.title || !fields.company || !fields.date) {
            return handleError(res, 400, 'Title, company and date are required');
        }

        // Industry keeps its current value when omitted
        if (!isBlank(industry) && parseIndustry(industry) === null) {
            return handleError(res, 400, INVALID_INDUSTRY_MESSAGE);
        }
        const jobIndustry = parseIndustry(industry) ?? existingJob.industry ?? INDUSTRY.SOFTWARE;

        const updatedJob = await model.updateJob(id, { ...fields, industry: jobIndustry });

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.JOB,
            entityId: id,
            description: `Job updated: ${fields.title} at ${fields.company}`,
            metadata: { job_id: id, company: fields.company, url: fields.url, industry: jobIndustry },
        });

        res.status(200).json({
            message: 'Job updated successfully',
            job: updatedJob,
        });
    } catch (error) {
        console.error('Update job error:', error);
        handleError(res, 500, 'Error updating job');
    }
};

exports.deleteJob = async (req, res) => {
    const { id } = req.params;

    try {
        const job = await model.getJobById(id);
        if (!job) {
            return handleError(res, 404, 'Job not found');
        }

        await model.deleteJob(id);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.JOB,
            entityId: id,
            description: `Job deleted: ${job.title} at ${job.company}`,
            metadata: { job_id: id, company: job.company },
        });

        res.status(200).json({ message: 'Job deleted successfully' });
    } catch (error) {
        console.error('Delete job error:', error);
        handleError(res, 500, 'Error deleting job');
    }
};

exports.deleteJobsByDate = async (req, res) => {
    const date = req.query.date || (req.body && req.body.date);

    if (!date) {
        return handleError(res, 400, 'Date is required');
    }
    if (!isIsoDate(date)) {
        return handleError(res, 400, 'Invalid date format. Expected YYYY-MM-DD');
    }

    try {
        const deletedJobs = await model.deleteJobsByDate(date);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.JOB,
            description: `Deleted ${deletedJobs.length} job(s) for date ${date}`,
            metadata: { date, count: deletedJobs.length },
        });

        res.status(200).json({
            message: `Deleted ${deletedJobs.length} job(s) for ${date}`,
            date,
            count: deletedJobs.length,
        });
    } catch (error) {
        console.error('Delete jobs by date error:', error);
        handleError(res, 500, 'Error deleting jobs for date');
    }
};
