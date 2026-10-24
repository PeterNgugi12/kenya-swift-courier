const express = require('express');
const superAdminController = require('../controllers/superAdmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');
const superAdminValidation = require('../validations/superAdmin.validation');
const { ROLES } = require('../config/constants');

const router = express.Router();

/**
 * @route   POST /api/super-admin/register
 * @desc    Register Super Admin (only works once)
 * @access  Public (but only works if no Super Admin exists)
 */
router.post(
  '/register',
  validate(superAdminValidation.register),
  superAdminController.register
);

/**
 * @route   POST /api/super-admin/login
 * @desc    Login Super Admin
 * @access  Public
 */
router.post(
  '/login',
  loginLimiter,
  validate(superAdminValidation.login),
  superAdminController.login
);

/**
 * @route   GET /api/super-admin/profile
 * @desc    Get Super Admin profile
 * @access  Private (Super Admin only)
 */
router.get(
  '/profile',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  superAdminController.getProfile
);

/**
 * @route   POST /api/super-admin/refresh-token
 * @desc    Refresh access token
 * @access  Public (with valid refresh token)
 */
router.post(
  '/refresh-token',
  superAdminController.refreshToken
);

// Update profile
router.put(
  '/profile',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  superAdminController.updateProfile
);

// Change password
router.post(
  '/change-password',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  superAdminController.changePassword
);

// Get notification preferences
router.get(
  '/notifications',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  superAdminController.getNotifications
);

// Update notification preferences
router.put(
  '/notifications',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  superAdminController.updateNotifications
);

// Delete account
router.delete(
  '/account',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  superAdminController.deleteAccount
);
/**
 * @route   POST /api/super-admin/logout
 * @desc    Logout Super Admin
 * @access  Private
 */
router.post(
  '/logout',
  authMiddleware,
  roleMiddleware(ROLES.SUPER_ADMIN),
  superAdminController.logout
);

module.exports = router;