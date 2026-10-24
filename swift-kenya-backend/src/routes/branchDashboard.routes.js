const express = require('express');
const branchDashboardController = require('../controllers/branchDashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All dashboard routes require authentication and BRANCH_OPERATOR role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.BRANCH_OPERATOR));

router.get('/stats', branchDashboardController.getStats);
router.get('/recent-parcels', branchDashboardController.getRecentParcels);
router.get('/branch-info', branchDashboardController.getBranchInfo);
router.get('/overdue-alerts', branchDashboardController.getOverdueAlerts);

module.exports = router;