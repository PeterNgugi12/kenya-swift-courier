const logger = require('./logger.util');

/**
 * Wraps an async function to catch errors and pass them to Express error handler
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    fn(req, res, next)
      .catch((error) => {
        // Log the error with request info
        logger.error(`❌ ${req.method} ${req.originalUrl} failed: ${error.message}`);
        
        // Pass to Express error handler
        next(error);
      })
      .finally(() => {
        // Log performance for slow requests
        const duration = Date.now() - startTime;
        if (duration > 1000) {
          logger.warn(`🐢 Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
      });
  };
};

module.exports = catchAsync;