const companyAuthService = require('../services/companyAuth.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');
const { body, validationResult } = require('express-validator');

class CompanyAuthController {
  // Validation rules
  validateLogin = [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
  ];

  validateChangePassword = [
    body('current_password')
      .notEmpty().withMessage('Current password is required'),
    body('new_password')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirm_password')
      .notEmpty().withMessage('Please confirm your new password')
      .custom((value, { req }) => value === req.body.new_password)
      .withMessage('Passwords do not match')
  ];

  // Login
  login = catchAsync(async (req, res) => {
    logger.info('Processing Company Admin login request');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const result = await companyAuthService.login(email, password);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        token: result.token,
        expiresIn: result.expiresIn
      }
    });
  });

  // Get Profile
  getProfile = catchAsync(async (req, res) => {
    logger.info(`Fetching profile for company admin: ${req.user.email}`);
    
    const profile = await companyAuthService.getProfile(req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: profile
    });
  });

  // Update Profile
  updateProfile = catchAsync(async (req, res) => {
    logger.info(`Updating profile for company admin: ${req.user.email}`);
    
    const updatedUser = await companyAuthService.updateProfile(req.user.id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  });

  // Change Password
  changePassword = catchAsync(async (req, res) => {
    logger.info(`Changing password for company admin: ${req.user.email}`);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors: errors.array()
      });
    }

    await companyAuthService.changePassword(req.user.id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password changed successfully'
    });
  });

  // Refresh Token
  refreshToken = catchAsync(async (req, res) => {
    logger.info('Processing token refresh request for company admin');
    
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const result = await companyAuthService.refreshToken(refreshToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  // Logout
  logout = catchAsync(async (req, res) => {
    logger.info(`Logging out company admin: ${req.user?.email}`);
    
    res.clearCookie('refreshToken');
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // Get Notifications
  getNotifications = catchAsync(async (req, res) => {
    const preferences = await companyAuthService.getNotifications(req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: preferences
    });
  });

  // Update Notifications
  updateNotifications = catchAsync(async (req, res) => {
    const preferences = await companyAuthService.updateNotifications(req.user.id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Notification preferences updated',
      data: preferences
    });
  });

  // Delete Account
  deleteAccount = catchAsync(async (req, res) => {
    logger.warn(`Account deletion requested for company admin: ${req.user.email}`);
    
    await companyAuthService.deleteAccount(req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Account deleted successfully'
    });
  });
}

module.exports = new CompanyAuthController();