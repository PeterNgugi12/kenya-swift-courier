const express = require('express');
const branchNotificationController = require('../controllers/branchNotification.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All routes require authentication and BRANCH_OPERATOR role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.BRANCH_OPERATOR));

router.get('/', branchNotificationController.getNotifications);

module.exports = router;