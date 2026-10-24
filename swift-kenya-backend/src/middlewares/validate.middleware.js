const AppError = require('../utils/appError.util');
const { HTTP_STATUS } = require('../config/constants');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors
      });
    }

    next();
  };
};

module.exports = validate;