const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { getClientIP } = require('../utils/ip.utils');

exports.getJobs = async (req, res) => {
    try {
        const { date, page = 1, limit = 20, search, orderDirection = 'ASC' } = req.query;
        const result = await model.getJobs(date, page, limit, search, orderDirection);

        res.status(200).json({
            jobs: result.jobs,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get jobs error:', error);
        handleError(res, 500, 'Error fetching jobs');
    }
}

exports.getTodayJobs = async (req, res) => {
    try {
        // Get today's date in PST/PDT timezone in YYYY-MM-DD format
        const now = new Date();
        // Convert to PST/PDT (America/Los_Angeles timezone)
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(now);
        const year = parts.find(part => part.type === 'year').value;
        const month = parts.find(part => part.type === 'month').value;
        const day = parts.find(part => part.type === 'day').value;
        const isoDate = `${year}-${month}-${day}`;
        const jobs = await model.getJobsByDate(isoDate);

        console.log(isoDate);

        res.status(200).json({
            date: isoDate,
            jobs,
            count: jobs.length
        });
    } catch (error) {
        console.error('Get today jobs error:', error);
        handleError(res, 500, 'Error fetching today\'s jobs');
    }
}

exports.getJob = async (req, res) => {
    const { id } = req.params;

    try {
        const job = await model.getJobById(id);

        if (!job) {
            return handleError(res, 404, 'Job not found');
        }

        res.status(200).json({
            job
        });
    } catch (error) {
        console.error('Get job error:', error);
        handleError(res, 500, 'Error fetching job');
    }
}

exports.createJob = async (req, res) => {
    const { title, company, tech, url, description, date } = req.body;

    // Validate required fields
    if (!title || !company || !date) {
        return handleError(res, 400, 'Title, company and date are required');
    }

    // Validate URL format if provided
    if (url) {
        try {
            new URL(url); // Validate URL format
        } catch (urlError) {
            return handleError(res, 400, 'Invalid URL format');
        }

        // Check if URL already exists using normalized URL
        // const existingJob = await model.getJobByUrl(url);
        // if (existingJob) {
        //     return handleError(res, 409, 'Job with this URL already exists');
        // }
    }

    // Check if company or URL is in block list
    const isBlocked = await model.isBlocked(company, url);
    if (isBlocked) {
        return handleError(res, 403, 'This job is blocked. Company name or URL is in the block list.');
    }

    const newJob = await model.createJob(title, company, tech, url, description, date);

    // Log history
    const userId = req.user ? req.user.id : null;
    const userEmail = req.user ? req.user.email : null;
    const clientIP = getClientIP(req);
    await model.createHistoryLog(
        userId,
        userEmail,
        'create',
        'job',
        newJob.id,
        `Job created: ${title} at ${company}`,
        clientIP,
        { job_id: newJob.id, company, url }
    );

    return res.status(201).json({
        message: 'Job created successfully',
        job: newJob
    });
}

exports.updateJob = async (req, res) => {
    const { id } = req.params;
    const { title, company, date, tech, url, description } = req.body;

    try {
        // Check if job exists
        const existingJob = await model.getJobById(id);
        if (!existingJob) {
            return handleError(res, 404, 'Job not found');
        }

        // Validate required fields
        if (!title || !company || !date) {
            return handleError(res, 400, 'Title, company and date are required');
        }

        // Update job
        const updatedJob = await model.updateJob(id, title, company, date, tech, url, description);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'update',
            'job',
            id,
            `Job updated: ${title} at ${company}`,
            clientIP,
            { job_id: id, company, url }
        );

        res.status(200).json({
            message: 'Job updated successfully',
            job: updatedJob
        });
    } catch (error) {
        console.error('Update job error:', error);
        handleError(res, 500, 'Error updating job');
    }
}

exports.deleteJob = async (req, res) => {
    const { id } = req.params;

    try {
        const job = await model.getJobById(id);
        if (!job) {
            return handleError(res, 404, 'Job not found');
        }

        await model.deleteJob(id);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'delete',
            'job',
            id,
            `Job deleted: ${job.title} at ${job.company}`,
            clientIP,
            { job_id: id, company: job.company }
        );

        res.status(200).json({
            message: 'Job deleted successfully'
        });
    } catch (error) {
        console.error('Delete job error:', error);
        handleError(res, 500, 'Error deleting job');
    }
}
