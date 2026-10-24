module.exports = {
  // User roles
  ROLES: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    BRANCH_OPERATOR: 'BRANCH_OPERATOR'
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER: 500
  },

  // Security constants
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 15 * 60 * 1000, // 15 minutes in milliseconds
    JWT_EXPIRY: '1d',
    BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12
  },

  // Regex patterns
  PATTERNS: {
    EMAIL: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    PASSWORD: /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
    PHONE: /^\+?[1-9]\d{1,14}$/
  },

  // API Messages
  MESSAGES: {
    SUPER_ADMIN: {
      EXISTS: 'Super Admin already exists. Only one Super Admin allowed.',
      CREATED: 'Super Admin registered successfully',
      LOGIN_SUCCESS: 'Login successful',
      INVALID_CREDENTIALS: 'Invalid email or password',
      ACCOUNT_LOCKED: 'Account temporarily locked. Too many failed attempts.',
      NOT_FOUND: 'Super Admin not found'
    }
  }
};