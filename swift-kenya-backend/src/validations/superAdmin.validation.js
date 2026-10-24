const Joi = require('joi');
const { PATTERNS } = require('../config/constants');

const superAdminValidation = {
  // Registration validation
  register: Joi.object({
    full_name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Full name must be at least 2 characters long',
        'string.max': 'Full name cannot exceed 100 characters',
        'any.required': 'Full name is required'
      }),
    
    email: Joi.string()
      .email()
      .pattern(PATTERNS.EMAIL)
      .required()
      .lowercase()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.pattern.base': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(8)
      .max(100)
      .pattern(PATTERNS.PASSWORD)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 100 characters',
        'string.pattern.base': 'Password must contain at least one letter and one number',
        'any.required': 'Password is required'
      })
  }),

  // Login validation
  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .lowercase()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  })
};

module.exports = superAdminValidation;