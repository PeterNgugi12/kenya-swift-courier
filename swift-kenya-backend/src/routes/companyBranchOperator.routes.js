const express = require('express');
const companyBranchOperatorController = require('../controllers/companyBranchOperator.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All routes require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

// CRUD operations
router.get('/', companyBranchOperatorController.getAllOperators);
router.get('/stats', companyBranchOperatorController.getOperatorStats);
router.post('/', companyBranchOperatorController.createOperator);
router.get('/:id', companyBranchOperatorController.getOperatorById);
router.put('/:id', companyBranchOperatorController.updateOperator);
router.patch('/:id/status', companyBranchOperatorController.updateOperatorStatus);
router.post('/:id/reset-password', companyBranchOperatorController.resetPassword);
router.delete('/:id', companyBranchOperatorController.deleteOperator);

module.exports = router;