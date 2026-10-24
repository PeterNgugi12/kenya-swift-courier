const { User, Company } = require('../models');
const JWTUtil = require('../utils/jwt.util');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const SecurityUtil = require('../utils/security.util');
const { ROLES, HTTP_STATUS, SECURITY } = require('../config/constants');

class CompanyAuthService {
  async login(email, password) {
    try {
      const sanitizedEmail = email.toLowerCase().trim();

      // Single query with include - no need for two separate queries
      const user = await User.findOne({ 
        where: { 
          email: sanitizedEmail,
          role: ROLES.COMPANY_ADMIN
        },
        include: [{
          model: Company,
          as: 'userCompany',
          required: false, // This makes it a LEFT JOIN
          attributes: ['id', 'name', 'code', 'status', 'logo_url', 'phone', 'email', 'address']
        }]
      });

      if (!user) {
        logger.warn(`Login attempt with non-existent company admin email: ${SecurityUtil.maskEmail(sanitizedEmail)}`);
        throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if user has a company_id
      if (!user.company_id) {
        logger.warn(`Company admin ${sanitizedEmail} has no company_id in database`);
        throw new AppError('Account not properly configured. Please contact Super Admin.', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if company exists
      if (!user.userCompany) {
        logger.warn(`Company admin ${sanitizedEmail} has company_id ${user.company_id} but company not found`);
        throw new AppError('Associated company not found. Please contact Super Admin.', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if account is locked
      if (user.isLocked && user.isLocked()) {
        throw new AppError('Account temporarily locked', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if user is active
      if (!user.is_active) {
        throw new AppError('Your account has been deactivated', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if company is active
      if (user.userCompany.status !== 'active') {
        throw new AppError('Your company account has been suspended', HTTP_STATUS.UNAUTHORIZED);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        if (user.incrementLoginAttempts) {
          await user.incrementLoginAttempts();
        }
        throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
      }

      // Reset login attempts on successful login
      if (user.resetLoginAttempts) {
        await user.resetLoginAttempts();
      }

      // Generate JWT token
      const token = JWTUtil.generateToken({
        userId: user.id,
        role: user.role,
        email: user.email,
        companyId: user.company_id,
        companyName: user.userCompany.name
      });

      // Generate refresh token
      const refreshToken = JWTUtil.generateRefreshToken({
        userId: user.id
      });

      // Remove sensitive data from response
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.login_attempts;
      delete userResponse.lock_until;

      logger.info(`Company Admin logged in successfully: ${SecurityUtil.maskEmail(sanitizedEmail)}`);

      return {
        user: userResponse,
        token,
        refreshToken,
        expiresIn: SECURITY.JWT_EXPIRY
      };
    } catch (error) {
      logger.error(`Company Admin login failed: ${error.message}`);
      throw error;
    }
  }

  async getProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password', 'login_attempts', 'lock_until'] },
        include: [{
          model: Company,
          as: 'userCompany',
          attributes: ['id', 'name', 'code', 'status', 'logo_url', 'phone', 'email', 'address']
        }]
      });

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      return user;
    } catch (error) {
      logger.error(`Profile retrieval failed: ${error.message}`);
      throw error;
    }
  }
    async changePassword(userId, passwordData) {
    try {
      const { current_password, new_password, confirm_password } = passwordData;

      if (new_password !== confirm_password) {
        throw new AppError('New passwords do not match', HTTP_STATUS.BAD_REQUEST);
      }

      if (new_password.length < 8) {
        throw new AppError('Password must be at least 8 characters long', HTTP_STATUS.BAD_REQUEST);
      }

      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      const isPasswordValid = await user.comparePassword(current_password);
      if (!isPasswordValid) {
        logger.warn(`Failed password change attempt for company admin: ${user.email}`);
        throw new AppError('Current password is incorrect', HTTP_STATUS.UNAUTHORIZED);
      }

      user.password = new_password;
      await user.save();

      logger.info(`Password changed successfully for company admin: ${user.email}`);

      return { success: true };
    } catch (error) {
      logger.error(`Password change failed: ${error.message}`);
      throw error;
    }
  }

  async getNotifications(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'notification_preferences']
      });

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      const defaultPreferences = {
        email_notifications: true,
        sms_notifications: true,
        low_balance_alerts: true
      };

      return user.notification_preferences || defaultPreferences;
    } catch (error) {
      logger.error(`Get notifications failed: ${error.message}`);
      throw error;
    }
  }

  async updateNotifications(userId, preferences) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

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

      const updatedPreferences = {
        ...(user.notification_preferences || {}),
        ...validPreferences
      };

      await user.update({ notification_preferences: updatedPreferences });

      return updatedPreferences;
    } catch (error) {
      logger.error(`Update notifications failed: ${error.message}`);
      throw error;
    }
  }

  async deleteAccount(userId) {
    const transaction = await sequelize.transaction();
    
    try {
      const user = await User.findByPk(userId, { transaction });

      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      // Soft delete by deactivating
      const deletedEmail = `deleted_${Date.now()}_${user.email}`;
      
      await user.update({ 
        is_active: false,
        email: deletedEmail
      }, { transaction });

      await transaction.commit();

      logger.warn(`Company admin account deleted: ${user.email}`);

      return { success: true };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Account deletion failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CompanyAuthService();