const express = require('express');
const companyDashboardController = require('../controllers/companyDashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All dashboard routes require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

router.get('/stats', companyDashboardController.getDashboardStats);
router.get('/weekly', companyDashboardController.getWeeklyData);
router.get('/branch-performance', companyDashboardController.getBranchPerformance);
router.get('/recent-trips', companyDashboardController.getRecentTrips);
router.get('/wallet', companyDashboardController.getWalletInfo);

module.exports = router;