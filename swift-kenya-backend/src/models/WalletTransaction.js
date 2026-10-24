const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  wallet_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('credit', 'debit', 'fee_deduction', 'adjustment'),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT
  },
  reference: {
    type: DataTypes.STRING(100)
  },
  created_by: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'wallet_transactions',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at'
});

module.exports = WalletTransaction;