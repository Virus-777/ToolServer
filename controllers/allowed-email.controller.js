'use strict';

const model = require('../database/model');
const { handleError, isValidEmail } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { HISTORY_ACTIONS, HISTORY_ENTITIES } = require('../config/constants');

exports.getAllowedEmails = async (req, res) => {
    try {
        const emails = await model.getAllowedEmails();
        res.status(200).json({ emails });
    } catch (error) {
        console.error('Get allowed emails error:', error);
        handleError(res, 500, 'Error fetching allowed emails');
    }
};

exports.getAllowedEmail = async (req, res) => {
    const { id } = req.params;

    try {
        const email = await model.getAllowedEmailById(id);
        if (!email) {
            return handleError(res, 404, 'Allowed email not found');
        }

        res.status(200).json({ email });
    } catch (error) {
        console.error('Get allowed email error:', error);
        handleError(res, 500, 'Error fetching allowed email');
    }
};

exports.createAllowedEmail = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return handleError(res, 400, 'Email is required');
    }
    if (!isValidEmail(email)) {
        return handleError(res, 400, 'Invalid email format');
    }

    try {
        if (await model.getAllowedEmailByEmail(email)) {
            return handleError(res, 400, 'Email already in allowed list');
        }

        const newEmail = await model.createAllowedEmail(email);

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.ALLOWED_EMAIL,
            entityId: newEmail.id,
            description: `Allowed email added: ${email}`,
            metadata: { email },
        });

        res.status(201).json({
            message: 'Allowed email created successfully',
            email: newEmail,
        });
    } catch (error) {
        console.error('Create allowed email error:', error);
        handleError(res, 500, 'Error creating allowed email');
    }
};

exports.updateAllowedEmail = async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
        return handleError(res, 400, 'Email is required');
    }
    if (!isValidEmail(email)) {
        return handleError(res, 400, 'Invalid email format');
    }

    try {
        const existingEmail = await model.getAllowedEmailById(id);
        if (!existingEmail) {
            return handleError(res, 404, 'Allowed email not found');
        }

        if (email !== existingEmail.email && (await model.getAllowedEmailByEmail(email))) {
            return handleError(res, 400, 'Email already in allowed list');
        }

        const updatedEmail = await model.updateAllowedEmail(id, email);

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.ALLOWED_EMAIL,
            entityId: id,
            description: `Allowed email updated: ${email}`,
            metadata: { email, old_email: existingEmail.email },
        });

        res.status(200).json({
            message: 'Allowed email updated successfully',
            email: updatedEmail,
        });
    } catch (error) {
        console.error('Update allowed email error:', error);
        handleError(res, 500, 'Error updating allowed email');
    }
};

exports.deleteAllowedEmail = async (req, res) => {
    const { id } = req.params;

    try {
        const email = await model.getAllowedEmailById(id);
        if (!email) {
            return handleError(res, 404, 'Allowed email not found');
        }

        await model.deleteAllowedEmail(id);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.ALLOWED_EMAIL,
            entityId: id,
            description: `Allowed email deleted: ${email.email}`,
            metadata: { email: email.email },
        });

        res.status(200).json({ message: 'Allowed email deleted successfully' });
    } catch (error) {
        console.error('Delete allowed email error:', error);
        handleError(res, 500, 'Error deleting allowed email');
    }
};
