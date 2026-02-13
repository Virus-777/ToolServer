const express = require('express');
const { 
    getAllAssemblyTokens, 
    getAssemblyToken, 
    createAssemblyToken, 
    updateAssemblyToken, 
    deleteAssemblyToken 
} = require('../controllers/assembly-token.controller');
const { authenticateAdmin } = require('../utils/auth.middleware');
const router = express.Router();

// All assembly token routes require admin authentication
router.route('/')
    .get(authenticateAdmin, getAllAssemblyTokens)
    .post(authenticateAdmin, createAssemblyToken);

router.route('/:id')
    .get(authenticateAdmin, getAssemblyToken)
    .put(authenticateAdmin, updateAssemblyToken)
    .delete(authenticateAdmin, deleteAssemblyToken);

module.exports = router;

