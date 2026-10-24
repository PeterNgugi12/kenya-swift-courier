const Joi = require('joi');

const companyValidation = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    code: Joi.string().min(2).max(20).uppercase().required(),
    logo_url: Joi.string().uri().optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().max(500).optional(),
    
    admin_name: Joi.string().min(2).max(100).required(),
    admin_email: Joi.string().email().required(),
    admin_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    admin_password: Joi.string().min(8).required()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(100),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    email: Joi.string().email(),
    address: Joi.string().max(500),
    logo_url: Joi.string().uri()
  }),

  status: Joi.object({
    status: Joi.string().valid('active', 'suspended', 'inactive').required()
  })
};

module.exports = companyValidation;