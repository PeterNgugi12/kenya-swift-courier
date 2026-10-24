const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SMSLog = sequelize.define('SMSLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  company_id: {
    type: DataTypes.UUID
  },
  parcel_id: {
    type: DataTypes.UUID
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  receiver_name: {
    type: DataTypes.STRING(100)
  },
  message: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed'),
    defaultValue: 'pending'
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2)
  },
  provider_reference: {
    type: DataTypes.STRING(100)
  },
  sent_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'sms_logs',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at'
});

module.exports = SMSLog;