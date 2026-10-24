const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Branch = sequelize.define('Branch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'companies',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true,
      isUppercase: true
    }
  },
  town: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  manager_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  manager_email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  manager_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  operator_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  parcel_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  revenue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'branches',
  hooks: {
    beforeCreate: (branch) => {
      if (branch.code) {
        branch.code = branch.code.toUpperCase();
      }
    },
    beforeUpdate: (branch) => {
      if (branch.changed('code') && branch.code) {
        branch.code = branch.code.toUpperCase();
      }
    }
  }
});

module.exports = Branch;