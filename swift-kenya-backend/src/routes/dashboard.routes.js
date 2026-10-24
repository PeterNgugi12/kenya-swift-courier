const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All dashboard routes require authentication and SUPER_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.SUPER_ADMIN));

router.get('/stats', dashboardController.getPlatformStats);
router.get('/trends', dashboardController.getMonthlyTrends);
router.get('/alerts', dashboardController.getSystemAlerts);

module.exports = router;