'use strict';

const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { HISTORY_ACTIONS, HISTORY_ENTITIES } = require('../config/constants');

exports.getBlockListItems = async (req, res) => {
    try {
        const items = await model.getAllBlockListItems();
        res.status(200).json({ items });
    } catch (error) {
        console.error('Get block list items error:', error);
        handleError(res, 500, 'Error fetching block list items');
    }
};

exports.getBlockListItem = async (req, res) => {
    const { id } = req.params;

    try {
        const item = await model.getBlockListItemById(id);
        if (!item) {
            return handleError(res, 404, 'Block list item not found');
        }

        res.status(200).json({ item });
    } catch (error) {
        console.error('Get block list item error:', error);
        handleError(res, 500, 'Error fetching block list item');
    }
};

exports.createBlockListItem = async (req, res) => {
    const { company_name: companyName, url } = req.body;

    if (!companyName && !url) {
        return handleError(res, 400, 'Either company_name or url must be provided');
    }

    try {
        const newItem = await model.createBlockListItem(companyName, url);

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.BLOCK_LIST,
            entityId: newItem.id,
            description: `Block list item created: ${companyName || url}`,
            metadata: { company_name: companyName, url },
        });

        res.status(201).json({
            message: 'Block list item created successfully',
            item: newItem,
        });
    } catch (error) {
        console.error('Create block list item error:', error);
        handleError(res, 500, 'Error creating block list item');
    }
};

exports.updateBlockListItem = async (req, res) => {
    const { id } = req.params;
    const { company_name: companyName, url } = req.body;

    try {
        const existingItem = await model.getBlockListItemById(id);
        if (!existingItem) {
            return handleError(res, 404, 'Block list item not found');
        }

        if (!companyName && !url) {
            return handleError(res, 400, 'Either company_name or url must be provided');
        }

        const updatedItem = await model.updateBlockListItem(id, companyName, url);

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.BLOCK_LIST,
            entityId: id,
            description: `Block list item updated: ${companyName || url}`,
            metadata: { company_name: companyName, url },
        });

        res.status(200).json({
            message: 'Block list item updated successfully',
            item: updatedItem,
        });
    } catch (error) {
        console.error('Update block list item error:', error);
        handleError(res, 500, 'Error updating block list item');
    }
};

exports.deleteBlockListItem = async (req, res) => {
    const { id } = req.params;

    try {
        const item = await model.getBlockListItemById(id);
        if (!item) {
            return handleError(res, 404, 'Block list item not found');
        }

        await model.deleteBlockListItem(id);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.BLOCK_LIST,
            entityId: id,
            description: `Block list item deleted: ${item.company_name || item.url}`,
            metadata: { company_name: item.company_name, url: item.url },
        });

        res.status(200).json({ message: 'Block list item deleted successfully' });
    } catch (error) {
        console.error('Delete block list item error:', error);
        handleError(res, 500, 'Error deleting block list item');
    }
};
