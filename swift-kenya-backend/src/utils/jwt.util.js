const jwt = require('jsonwebtoken');
const AppError = require('./appError.util');
const { HTTP_STATUS } = require('../config/constants');

class JWTUtil {
  static generateToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN,
        issuer: 'courier-api',
        audience: 'courier-client'
      }
    );
  }

  static generateRefreshToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: '7d',
        issuer: 'courier-api',
        audience: 'courier-client'
      }
    );
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'courier-api',
        audience: 'courier-client'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token has expired', HTTP_STATUS.UNAUTHORIZED);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid token', HTTP_STATUS.UNAUTHORIZED);
      }
      throw new AppError('Authentication failed', HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: 'courier-api',
        audience: 'courier-client'
      });
    } catch (error) {
      throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = JWTUtil;