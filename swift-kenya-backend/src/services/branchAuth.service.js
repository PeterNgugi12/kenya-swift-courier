const { User, Branch, Company } = require('../models');
const { sequelize } = require('../config/database');
const JWTUtil = require('../utils/jwt.util');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const SecurityUtil = require('../utils/security.util');
const { ROLES, HTTP_STATUS, SECURITY } = require('../config/constants');
const bcrypt = require('bcrypt');

class BranchAuthService {
  async login(email, password) {
    try {
      const sanitizedEmail = email.toLowerCase().trim();

      // Find branch operator
      const user = await User.findOne({ 
        where: { 
          email: sanitizedEmail,
          role: ROLES.BRANCH_OPERATOR
        },
        include: [
          {
            model: Branch,
            as: 'userBranch',
            attributes: ['id', 'name', 'code', 'town', 'company_id', 'is_active']
          },
          {
            model: Company,
            as: 'userCompany',
            attributes: ['id', 'name', 'code', 'status']
          }
        ]
      });

      if (!user) {
        logger.warn(`Login attempt with non-existent branch operator email: ${SecurityUtil.maskEmail(sanitizedEmail)}`);
        throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if branch exists and is active
      if (!user.userBranch) {
        logger.warn(`Branch operator ${sanitizedEmail} has no associated branch`);
        throw new AppError('Account not properly configured', HTTP_STATUS.UNAUTHORIZED);
      }

      if (!user.userBranch.is_active) {
        logger.warn(`Login attempt on inactive branch: ${user.userBranch.name}`);
        throw new AppError('This branch is currently inactive', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if company is active
      if (user.userCompany && user.userCompany.status !== 'active') {
        logger.warn(`Login attempt for suspended company: ${user.userCompany.name}`);
        throw new AppError('Company account is suspended', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if account is locked
      if (user.isLocked && user.isLocked()) {
        throw new AppError('Account temporarily locked', HTTP_STATUS.UNAUTHORIZED);
      }

      // Check if user is active
      if (!user.is_active) {
        throw new AppError('Your account has been deactivated', HTTP_STATUS.UNAUTHORIZED);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        if (user.incrementLoginAttempts) {
          await user.incrementLoginAttempts();
        }
        throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
      }

      // Reset login attempts
      if (user.resetLoginAttempts) {
        await user.resetLoginAttempts();
      }

      // Generate JWT token
      const token = JWTUtil.generateToken({
        userId: user.id,
        role: user.role,
        email: user.email,
        branchId: user.branch_id,
        companyId: user.company_id
      });

      const refreshToken = JWTUtil.generateRefreshToken({
        userId: user.id
      });

      // Remove sensitive data
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.login_attempts;
      delete userResponse.lock_until;

      return {
        user: {
          ...userResponse,
          branch: user.userBranch,
          company: user.userCompany
        },
        token,
        refreshToken,
        expiresIn: SECURITY.JWT_EXPIRY
      };
    } catch (error) {
      logger.error(`Branch Operator login failed: ${error.message}`);
      throw error;
    }
  }

async getProfile(userId) {
  try {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password', 'login_attempts', 'lock_until'] },
      include: [
        {
          model: Branch,
          as: 'userBranch',
          attributes: ['id', 'name', 'code', 'town', 'company_id']
        },
        {
          model: Company,
          as: 'userCompany',
          attributes: ['id', 'name', 'code']
        }
      ]
    });

    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    // Log the raw user data for debugging
    console.log('Raw user data:', JSON.stringify(user, null, 2));

    // Transform the data to match frontend expectations
    const profileData = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      branch: user.userBranch ? {
        id: user.userBranch.id,
        name: user.userBranch.name,
        code: user.userBranch.code,
        town: user.userBranch.town,
        company: user.userCompany ? {
          id: user.userCompany.id,
          name: user.userCompany.name,
          code: user.userCompany.code
        } : null
      } : null
    };

    console.log('Transformed profile data:', profileData);
    return profileData;
  } catch (error) {
    logger.error(`Profile retrieval failed: ${error.message}`);
    throw error;
  }
}

  async updateProfile(userId, data) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      const allowedUpdates = {};
      if (data.full_name) allowedUpdates.full_name = data.full_name.trim();
      if (data.phone) allowedUpdates.phone = data.phone.trim();

      await user.update(allowedUpdates);

      return this.getProfile(userId);
    } catch (error) {
      logger.error(`Profile update failed: ${error.message}`);
      throw error;
    }
  }

  async changePassword(userId, data) {
    try {
      const { current_password, new_password, confirm_password } = data;

      if (new_password !== confirm_password) {
        throw new AppError('Passwords do not match', HTTP_STATUS.BAD_REQUEST);
      }

      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
      }

      const isValid = await user.comparePassword(current_password);
      if (!isValid) {
        throw new AppError('Current password is incorrect', HTTP_STATUS.UNAUTHORIZED);
      }

      user.password = new_password;
      await user.save();

      return { success: true };
    } catch (error) {
      logger.error(`Password change failed: ${error.message}`);
      throw error;
    }
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = JWTUtil.verifyRefreshToken(refreshToken);
      
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Branch,
            as: 'userBranch',
            attributes: ['id', 'name', 'is_active']
          }
        ]
      });

      if (!user || !user.is_active) {
        throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED);
      }

      if (user.userBranch && !user.userBranch.is_active) {
        throw new AppError('Branch is inactive', HTTP_STATUS.UNAUTHORIZED);
      }

      const newToken = JWTUtil.generateToken({
        userId: user.id,
        role: user.role,
        email: user.email,
        branchId: user.branch_id,
        companyId: user.company_id
      });

      return {
        token: newToken,
        expiresIn: SECURITY.JWT_EXPIRY
      };
    } catch (error) {
      logger.error(`Token refresh failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new BranchAuthService();