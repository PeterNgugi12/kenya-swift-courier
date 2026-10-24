const express = require('express');
const companyBranchController = require('../controllers/companyBranch.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All branch routes require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

// Branch CRUD operations
router.get('/', companyBranchController.getAllBranches);
router.post('/', companyBranchController.createBranch);
router.get('/:id', companyBranchController.getBranchById);
router.put('/:id', companyBranchController.updateBranch);
router.patch('/:id/status', companyBranchController.updateBranchStatus);
router.delete('/:id', companyBranchController.deleteBranch);

module.exports = router;