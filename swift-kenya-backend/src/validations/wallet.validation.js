const Joi = require('joi');

const walletValidation = {
  adjust: Joi.object({
    amount: Joi.number().required().messages({
      'number.base': 'Amount must be a number',
      'any.required': 'Amount is required'
    }),
    reason: Joi.string().min(3).max(500).required()
  })
};

module.exports = walletValidation;