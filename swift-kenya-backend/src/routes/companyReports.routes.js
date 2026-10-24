const express = require('express');
const companyReportsController = require('../controllers/companyReports.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All report routes require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

router.get('/summary', companyReportsController.getSummary);
router.get('/monthly', companyReportsController.getMonthlyBreakdown);
router.get('/export', companyReportsController.exportReport);

module.exports = router;