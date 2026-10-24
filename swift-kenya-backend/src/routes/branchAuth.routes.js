const express = require('express');
const branchAuthController = require('../controllers/branchAuth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

// Public routes
router.post('/login', loginLimiter, branchAuthController.validateLogin, branchAuthController.login);
router.post('/refresh-token', branchAuthController.refreshToken);

// Protected routes - require authentication and BRANCH_OPERATOR role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.BRANCH_OPERATOR));

router.get('/profile', branchAuthController.getProfile);
router.put('/profile', branchAuthController.updateProfile);
router.post('/change-password', branchAuthController.validateChangePassword, branchAuthController.changePassword);
router.post('/logout', branchAuthController.logout);

module.exports = router;