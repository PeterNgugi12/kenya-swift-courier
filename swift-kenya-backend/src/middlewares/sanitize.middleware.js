const xss = require('xss');
const SecurityUtil = require('../utils/security.util');
const logger = require('../utils/logger.util');

const sanitizeMiddleware = (req, res, next) => {
  try {
    // Sanitize body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Check for suspicious patterns
          if (SecurityUtil.detectSuspiciousInput(req.body[key])) {
            logger.warn(`Suspicious input detected in field ${key} from IP ${req.ip}`);
          }
          
          // Sanitize the input
          req.body[key] = xss(req.body[key].trim());
          req.body[key] = SecurityUtil.sanitizeInput(req.body[key]);
        }
      });
    }

    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = xss(req.query[key].trim());
          req.query[key] = SecurityUtil.sanitizeInput(req.query[key]);
        }
      });
    }

    // Sanitize params
    if (req.params) {
      Object.keys(req.params).forEach(key => {
        if (typeof req.params[key] === 'string') {
          req.params[key] = xss(req.params[key].trim());
          req.params[key] = SecurityUtil.sanitizeInput(req.params[key]);
        }
      });
    }

    next();
  } catch (error) {
    logger.error(`Sanitization error: ${error.message}`);
    next(error);
  }
};

module.exports = sanitizeMiddleware;