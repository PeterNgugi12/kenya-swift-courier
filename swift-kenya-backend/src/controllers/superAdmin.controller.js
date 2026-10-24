const superAdminService = require('../services/superAdmin.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS, MESSAGES } = require('../config/constants');
const logger = require('../utils/logger.util');

class SuperAdminController {
  // Register Super Admin
  register = catchAsync(async (req, res, next) => {
    logger.info('Processing Super Admin registration request');
    
    const superAdmin = await superAdminService.registerSuperAdmin(req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.SUPER_ADMIN.CREATED,
      data: superAdmin
    });
  });

  // Login Super Admin
  login = catchAsync(async (req, res, next) => {
    logger.info('Processing Super Admin login request');
    
    const { email, password } = req.body;
    const result = await superAdminService.loginSuperAdmin(email, password);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUPER_ADMIN.LOGIN_SUCCESS,
      data: {
        user: result.user,
        token: result.token,
        expiresIn: result.expiresIn
      }
    });
  });

  // Get current Super Admin profile
  getProfile = catchAsync(async (req, res, next) => {
    logger.info(`Fetching profile for user: ${req.user.email}`);
    
    const profile = await superAdminService.getProfile(req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: profile
    });
  });

  // Refresh token
  refreshToken = catchAsync(async (req, res, next) => {
    logger.info('Processing token refresh request');
    
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const result = await superAdminService.refreshToken(refreshToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });
  // Update profile
updateProfile = catchAsync(async (req, res) => {
  logger.info(`Updating profile for user: ${req.user.email}`);
  
  const updatedUser = await superAdminService.updateProfile(req.user.id, req.body);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedUser
  });
});

// Change password
changePassword = catchAsync(async (req, res) => {
  logger.info(`Changing password for user: ${req.user.email}`);
  
  await superAdminService.changePassword(req.user.id, req.body);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Get notification preferences
getNotifications = catchAsync(async (req, res) => {
  const preferences = await superAdminService.getNotifications(req.user.id);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: preferences
  });
});

// Update notification preferences
updateNotifications = catchAsync(async (req, res) => {
  const preferences = await superAdminService.updateNotifications(req.user.id, req.body);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Notification preferences updated',
    data: preferences
  });
});

// Delete account
deleteAccount = catchAsync(async (req, res) => {
  logger.warn(`Account deletion requested for user: ${req.user.email}`);
  
  await superAdminService.deleteAccount(req.user.id);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Account deleted successfully'
  });
});

  // Logout
  logout = catchAsync(async (req, res, next) => {
    logger.info(`Logging out user: ${req.user?.email}`);
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}

module.exports = new SuperAdminController();