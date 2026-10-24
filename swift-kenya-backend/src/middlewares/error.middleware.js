const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS } = require('../config/constants');

const errorMiddleware = (err, req, res, next) => {
  err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER;
  err.status = err.status || 'error';

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: req.user?.email
  });

  // Handle specific database errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    err = new AppError('Email already exists', HTTP_STATUS.CONFLICT);
  }

  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message);
    err = new AppError(messages.join('. '), HTTP_STATUS.BAD_REQUEST);
  }

  // Development error response
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err
    });
  }

  // Production error response
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // Programming or unknown errors
  return res.status(HTTP_STATUS.INTERNAL_SERVER).json({
    success: false,
    message: 'Something went wrong. Please try again later.'
  });
};

module.exports = errorMiddleware;