const express = require('express');
const smsController = require('../controllers/sms.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All SMS routes require authentication and SUPER_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.SUPER_ADMIN));

router.get('/', smsController.getSMSLogs);
router.get('/stats', smsController.getSMSStats);
router.post('/:id/resend', smsController.resendFailedSMS);

module.exports = router;