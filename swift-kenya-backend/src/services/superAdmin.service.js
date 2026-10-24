const User = require('../models/User');
const JWTUtil = require('../utils/jwt.util');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const SecurityUtil = require('../utils/security.util');
const { ROLES, HTTP_STATUS, MESSAGES, SECURITY } = require('../config/constants');
const { sequelize } = require('../config/database'); // Add this for transactions
const bcrypt = require('bcrypt');

class SuperAdminService {
  // ==================== AUTHENTICATION METHODS ====================

  async registerSuperAdmin(userData) {
    try {
      const { full_name, email, password } = userData;

      // Sanitize inputs
      const sanitizedEmail = email.toLowerCase().trim();
      const sanitizedName = SecurityUtil.sanitizeInput(full_name);

      // Check if Super Admin already exists
      const superAdminExists = await User.checkSuperAdminExists();
      if (superAdminExists) {
        logger.warn(`Attempted to create second Super Admin with email: ${sanitizedEmail}`);
        throw new AppError(MESSAGES.SUPER_ADMIN.EXISTS, HTTP_STATUS.CONFLICT);
      }

      // Check if email already exists
      const existingUser = await User.findByEmail(sanitizedEmail);
      if (existingUser) {
        logger.warn(`Registration attempt with existing email: ${SecurityUtil.maskEmail(sanitizedEmail)}`);
        throw new AppError('Email already registered', HTTP_STATUS.CONFLICT);
      }

      // Create Super Admin using transaction
      const superAdmin = await User.createSuperAdminSafely({
        full_name: sanitizedName,
        email: sanitizedEmail,
        password,
        role: ROLES.SUPER_ADMIN,
        is_active: true
      });

      logger.info(`Super Admin created successfully: ${SecurityUtil.maskEmail(sanitizedEmail)}`);

      return superAdmin;
    } catch (error) {
      logger.error(`Super Admin registration failed: ${error.message}`);
      throw error;
    }
  }

  async loginSuperAdmin(email, password) {
    try {
      const sanitizedEmail = email.toLowerCase().trim();

      // Find user by email
      const user = await User.findOne({ 
        where: { 
          email: sanitizedEmail,
          role: ROLES.SUPER_ADMIN
        } 
      });

      if (!user) {
        logger.warn(`Login attempt with non-existent email: ${SecurityUtil.maskEmail(sanitizedEmail)}`);
        throw new AppError(MESSAGES.SUPER_ADMIN.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if account is locked
      if (user.isLocked()) {
        logger.warn(`Login attempt on locked account: ${SecurityUtil.maskEmail(sanitizedEmail)}`);
        throw new AppError(MESSAGES.SUPER_ADMIN.ACCOUNT_LOCKED, HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if user is active
      if (!user.is_active) {
        logger.warn(`Login attempt on deactivated account: ${SecurityUtil.maskEmail(sanitizedEmail)}`);
        throw new AppError('Your account has been deactivated', HTTP_STATUS.UNAUTHORIZED);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incrementLoginAttempts();
        
        logger.warn(`Failed login attempt for: ${SecurityUtil.maskEmail(sanitizedEmail)}. Attempts: ${user.login_attempts + 1}`);
        
        // Check if account should be locked
        if (user.login_attempts + 1 >= SECURITY.MAX_LOGIN_ATTEMPTS) {
          throw new AppError(MESSAGES.SUPER_ADMIN.ACCOUNT_LOCKED, HTTP_STATUS.UNAUTHORIZED);
        }
        
        throw new AppError(MESSAGES.SUPER_ADMIN.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Generate JWT token
      const token = JWTUtil.generateToken({
        userId: user.id,
        role: user.role,
        email: user.email
      });

      // Generate refresh token
      const refreshToken = JWTUtil.generateRefreshToken({
        userId: user.id
      });

      // Remove password from response
      const userResponse = user.toJSON();
      delete userResponse.password;

      logger.info(`Super Admin logged in successfully: ${SecurityUtil.maskEmail(sanitizedEmail)}`);

      return {
        user: userResponse,
        token,
        refreshToken,
        expiresIn: SECURITY.JWT_EXPIRY
      };
    } catch (error) {
      logger.error(`Super Admin login failed: ${error.message}`);
      throw error;
    }
  }

  async getProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password', 'login_attempts', 'lock_until'] }
      });

      if (!user) {
        throw new AppError(MESSAGES.SUPER_ADMIN.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      logger.debug(`Profile retrieved for user: ${SecurityUtil.maskEmail(user.email)}`);
      
      return user;
    } catch (error) {
      logger.error(`Profile retrieval failed: ${error.message}`);
      throw error;
    }
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = JWTUtil.verifyRefreshToken(refreshToken);
      
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });

      if (!user || !user.is_active) {
        throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED);
      }

      // Generate new access token
      const newToken = JWTUtil.generateToken({
        userId: user.id,
        role: user.role,
        email: user.email
      });

      logger.debug(`Token refreshed for user: ${SecurityUtil.maskEmail(user.email)}`);

      return {
        token: newToken,
        expiresIn: SECURITY.JWT_EXPIRY
      };
    } catch (error) {
      logger.error(`Token refresh failed: ${error.message}`);
      throw error;
    }
  }

  // ==================== PROFILE MANAGEMENT METHODS ====================

  /**
   * Update Super Admin profile
   */
  async updateProfile(userId, updateData) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      // Update only allowed fields
      const allowedUpdates = {};
      
      if (updateData.full_name) {
        allowedUpdates.full_name = SecurityUtil.sanitizeInput(updateData.full_name.trim());
      }
      
      if (updateData.phone) {
        allowedUpdates.phone = updateData.phone.trim();
      }
      
      if (updateData.email) {
        const newEmail = updateData.email.toLowerCase().trim();
        
        // Check if email is already taken by another user
        if (newEmail !== user.email) {
          const existingUser = await User.findOne({ 
            where: { email: newEmail } 
          });
          if (existingUser) {
            throw new AppError('Email already in use', HTTP_STATUS.CONFLICT);
          }
        }
        allowedUpdates.email = newEmail;
      }

      await user.update(allowedUpdates);
      
      logger.info(`Profile updated for user: ${user.email}`);

      // Return user without sensitive data
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.login_attempts;
      delete userResponse.lock_until;

      return userResponse;
    } catch (error) {
      logger.error(`Profile update failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change Super Admin password
   */
  async changePassword(userId, passwordData) {
    try {
      const { current_password, new_password, confirm_password } = passwordData;

      // Validate passwords match
      if (new_password !== confirm_password) {
        throw new AppError('New passwords do not match', HTTP_STATUS.BAD_REQUEST);
      }

      // Validate password strength
      if (new_password.length < 8) {
        throw new AppError('Password must be at least 8 characters long', HTTP_STATUS.BAD_REQUEST);
      }

      // Password strength validation
      const hasUpperCase = /[A-Z]/.test(new_password);
      const hasLowerCase = /[a-z]/.test(new_password);
      const hasNumbers = /\d/.test(new_password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(new_password);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        throw new AppError(
          'Password must contain at least one uppercase letter, one lowercase letter, and one number', 
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(current_password);
      if (!isPasswordValid) {
        logger.warn(`Failed password change attempt for user: ${user.email} - Invalid current password`);
        throw new AppError('Current password is incorrect', HTTP_STATUS.UNAUTHORIZED);
      }

      // Update password (will be hashed by model hook)
      user.password = new_password;
      await user.save();

      logger.info(`Password changed successfully for user: ${user.email}`);

      return { success: true };
    } catch (error) {
      logger.error(`Password change failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get notification preferences
   */
  async getNotifications(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'notification_preferences']
      });

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      // Default preferences if not set
      const defaultPreferences = {
        email_notifications: true,
        sms_notifications: true,
        low_balance_alerts: true
      };

      const preferences = user.notification_preferences || defaultPreferences;

      return preferences;
    } catch (error) {
      logger.error(`Get notifications failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotifications(userId, preferences) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      // Validate and sanitize preferences
      const validPreferences = {};
      
      if (preferences.email_notifications !== undefined) {
        validPreferences.email_notifications = Boolean(preferences.email_notifications);
      }
      if (preferences.sms_notifications !== undefined) {
        validPreferences.sms_notifications = Boolean(preferences.sms_notifications);
      }
      if (preferences.low_balance_alerts !== undefined) {
        validPreferences.low_balance_alerts = Boolean(preferences.low_balance_alerts);
      }

      // Merge with existing preferences
      const updatedPreferences = {
        ...(user.notification_preferences || {}),
        ...validPreferences
      };

      await user.update({ 
        notification_preferences: updatedPreferences
      });

      logger.info(`Notification preferences updated for user: ${user.email}`);

      return updatedPreferences;
    } catch (error) {
      logger.error(`Update notifications failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete Super Admin account (soft delete)
   */
  async deleteAccount(userId) {
    const transaction = await sequelize.transaction();
    
    try {
      const user = await User.findByPk(userId, { transaction });

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      // Check if this is the only Super Admin
      const superAdminCount = await User.count({
        where: { role: ROLES.SUPER_ADMIN },
        transaction
      });

      if (superAdminCount === 1) {
        throw new AppError('Cannot delete the only Super Admin account', HTTP_STATUS.BAD_REQUEST);
      }

      // Soft delete by deactivating and marking email as deleted
      const deletedEmail = `deleted_${Date.now()}_${user.email}`;
      
      await user.update({ 
        is_active: false,
        email: deletedEmail, // Prevent email reuse
        full_name: '[Deleted User]'
      }, { transaction });

      await transaction.commit();

      logger.warn(`Super Admin account deleted: ${user.email} -> ${deletedEmail}`);

      return { success: true };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Account deletion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hard delete Super Admin account (use with caution)
   */
  async hardDeleteAccount(userId) {
    const transaction = await sequelize.transaction();
    
    try {
      const user = await User.findByPk(userId, { transaction });

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      // Check if this is the only Super Admin
      const superAdminCount = await User.count({
        where: { role: ROLES.SUPER_ADMIN },
        transaction
      });

      if (superAdminCount === 1) {
        throw new AppError('Cannot delete the only Super Admin account', HTTP_STATUS.BAD_REQUEST);
      }

      // Permanently delete user
      await user.destroy({ transaction });

      await transaction.commit();

      logger.warn(`Super Admin account permanently deleted: ${user.email}`);

      return { success: true };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Hard delete account failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SuperAdminService();