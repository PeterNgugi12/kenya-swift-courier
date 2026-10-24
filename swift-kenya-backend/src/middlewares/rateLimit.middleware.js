const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req, res) => {
      // Safe IPv6-aware IP handling
      const ip = ipKeyGenerator(req);

      // For login attempts, combine IP + email
      if (req.body && req.body.email) {
        return `${ip}-${req.body.email}`;
      }

      return ip;
    }
  });
};

const loginLimiter = createRateLimiter(
  15 * 60 * 1000,
  parseInt(process.env.LOGIN_RATE_LIMIT_ATTEMPTS) || 5,
  'Too many login attempts. Please try again after 15 minutes.'
);

const apiLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  'Too many requests. Please slow down.'
);

module.exports = { loginLimiter, apiLimiter };