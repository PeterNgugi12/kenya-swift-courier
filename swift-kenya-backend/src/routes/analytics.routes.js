const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All analytics routes require authentication and SUPER_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.SUPER_ADMIN));

router.get('/company-comparison', analyticsController.getCompanyComparison);
router.get('/market-share', analyticsController.getMarketShare);

module.exports = router;