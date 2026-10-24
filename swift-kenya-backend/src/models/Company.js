const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Company name cannot be empty'
      },
      len: {
        args: [2, 100],
        msg: 'Company name must be between 2 and 100 characters'
      }
    }
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'Company code cannot be empty'
      },
      len: {
        args: [2, 20],
        msg: 'Company code must be between 2 and 20 characters'
      },
      isUppercase: {
        msg: 'Company code must be uppercase'
      }
    }
  },
  logo_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'inactive'),
    defaultValue: 'active'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      // Only validate if value is provided (not null/undefined)
      isValidPhone(value) {
        if (value && value.trim() === '') {
          throw new Error('Phone cannot be empty string');
        }
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'Please provide a valid email address',
        args: true
      },
      // Prevent empty string
      notEmptyIfPresent(value) {
        if (value && value.trim() === '') {
          throw new Error('Email cannot be empty string');
        }
      }
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      // Prevent empty string
      notEmptyIfPresent(value) {
        if (value && value.trim() === '') {
          throw new Error('Address cannot be empty string');
        }
      }
    }
  }
}, {
  tableName: 'companies',
  hooks: {
    beforeValidate: (company) => {
      // Trim string fields before validation
      if (company.name && typeof company.name === 'string') {
        company.name = company.name.trim();
      }
      if (company.code && typeof company.code === 'string') {
        company.code = company.code.trim().toUpperCase();
      }
      if (company.phone && typeof company.phone === 'string') {
        company.phone = company.phone.trim() || null;
      }
      if (company.email && typeof company.email === 'string') {
        company.email = company.email.trim().toLowerCase() || null;
      }
      if (company.address && typeof company.address === 'string') {
        company.address = company.address.trim() || null;
      }
    }
  }
});

module.exports = Company;