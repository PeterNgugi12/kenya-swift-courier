const AppError = require('../utils/appError.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Role check failed: User not authenticated');
      return next(new AppError('User not authenticated', HTTP_STATUS.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Role check failed: User ${req.user.email} with role ${req.user.role} attempted to access restricted resource`);
      return next(new AppError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`, 
        HTTP_STATUS.FORBIDDEN
      ));
    }

    logger.debug(`Role check passed: ${req.user.role}`);
    next();
  };
};

module.exports = roleMiddleware;