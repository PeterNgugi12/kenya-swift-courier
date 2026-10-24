const express = require('express');
const companyAuthController = require('../controllers/companyAuth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

// Public routes
router.post('/login', loginLimiter, companyAuthController.validateLogin, companyAuthController.login);
router.post('/refresh-token', companyAuthController.refreshToken);

// Protected routes - require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

// Profile routes
router.get('/profile', companyAuthController.getProfile);
router.put('/profile', companyAuthController.updateProfile);

// Password routes
router.post('/change-password', companyAuthController.changePassword);

// Notification routes
router.get('/notifications', companyAuthController.getNotifications);
router.put('/notifications', companyAuthController.updateNotifications);

// Logout
router.post('/logout', companyAuthController.logout);

// Account deletion
router.delete('/account', companyAuthController.deleteAccount);

module.exports = router;