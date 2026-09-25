'use strict';

const model = require('../database/model');
const { handleError, parsePagination } = require('../utils/utils');
const { PAGINATION } = require('../config/constants');

exports.getHistoryLogs = async (req, res) => {
    try {
        const { user_id: userId, action_type: actionType, entity_type: entityType } = req.query;
        const { page, limit } = parsePagination(req.query, {
            defaultLimit: PAGINATION.HISTORY_DEFAULT_LIMIT,
            maxLimit: PAGINATION.MAX_LIMIT,
        });

        const result = await model.getHistoryLogs({ page, limit, userId, actionType, entityType });

        res.status(200).json({
            logs: result.logs,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get history logs error:', error);
        handleError(res, 500, 'Error fetching history logs');
    }
};

exports.getHistoryLog = async (req, res) => {
    const { id } = req.params;

    try {
        const log = await model.getHistoryLogById(id);
        if (!log) {
            return handleError(res, 404, 'History log not found');
        }

        res.status(200).json({ log });
    } catch (error) {
        console.error('Get history log error:', error);
        handleError(res, 500, 'Error fetching history log');
    }
};
