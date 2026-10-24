const JWTUtil = require('../utils/jwt.util');
const AppError = require('../utils/appError.util');
const { User } = require('../models'); 
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('No token provided', HTTP_STATUS.UNAUTHORIZED));
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = JWTUtil.verifyToken(token);
    
    // Check if user still exists
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      logger.warn(`Authentication failed: User ${decoded.userId} not found`);
      return next(new AppError('User no longer exists', HTTP_STATUS.UNAUTHORIZED));
    }

    // Check if user is active
    if (!user.is_active) {
      logger.warn(`Authentication failed: User ${user.email} account is deactivated`);
      return next(new AppError('Your account has been deactivated', HTTP_STATUS.UNAUTHORIZED));
    }

    // Attach user to request with ALL fields including company_id AND branch_id
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      full_name: user.full_name,
      company_id: user.company_id,
      branch_id: user.branch_id  // ✅ ADD THIS LINE - THIS IS CRITICAL
    };
    
    logger.debug(`User authenticated: ${user.email} (Role: ${user.role}, Company ID: ${user.company_id}, Branch ID: ${user.branch_id})`);
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    next(error);
  }
};

module.exports = authMiddleware;