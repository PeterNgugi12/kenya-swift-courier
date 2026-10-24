// models/Wallet.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// In models/Wallet.js - update the model definition
const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: 0
    },
    get() {
      const value = this.getDataValue('balance');
      return value ? Number(value) : 0;
    },
    set(value) {
      this.setDataValue('balance', Number(value));
    }
  },
  total_credits: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    get() {
      const value = this.getDataValue('total_credits');
      return value ? Number(value) : 0;
    },
    set(value) {
      this.setDataValue('total_credits', Number(value));
    }
  },
  total_deductions: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    get() {
      const value = this.getDataValue('total_deductions');
      return value ? Number(value) : 0;
    },
    set(value) {
      this.setDataValue('total_deductions', Number(value));
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'closed'),
    defaultValue: 'active'
  }
}, {
  tableName: 'wallets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Instance methods
// models/Wallet.js - Update the debit method

Wallet.prototype.debit = async function(amount, description, reference, userId, transaction) {
  try {
    console.log("=".repeat(40));
    console.log("💰 DEBIT METHOD CALLED");
    console.log("=".repeat(40));
    
    // FORCE conversion to numbers
    const currentBalance = Number(this.balance) || 0;
    const amountToDeduct = Number(amount) || 0;
    
    console.log('Current balance (raw):', this.balance, 'type:', typeof this.balance);
    console.log('Current balance (converted):', currentBalance);
    console.log('Amount to deduct (raw):', amount, 'type:', typeof amount);
    console.log('Amount to deduct (converted):', amountToDeduct);
    console.log('Current total_deductions:', this.total_deductions);
    
    // Validate amount
    if (amountToDeduct <= 0) {
      throw new Error(`Invalid debit amount: ${amountToDeduct}`);
    }
    
    // Check sufficient balance
    if (currentBalance < amountToDeduct) {
      throw new Error(`Insufficient balance: ${currentBalance} < ${amountToDeduct}`);
    }

    // Calculate new values
    const newBalance = currentBalance - amountToDeduct;
    const currentDeductions = Number(this.total_deductions || 0);
    const newDeductions = currentDeductions + amountToDeduct;
    
    console.log('New balance:', newBalance);
    console.log('New deductions:', newDeductions);

    // Update wallet balance - IMPORTANT: Use setDataValue to ensure proper conversion
    this.setDataValue('balance', newBalance);
    this.setDataValue('total_deductions', newDeductions);
    
    // Save with transaction
    await this.save({ transaction });
    
    console.log('✅ Wallet saved successfully');

    // Get the WalletTransaction model dynamically
    const WalletTransaction = require('./WalletTransaction');
    
    // Create transaction record
    await WalletTransaction.create({
      wallet_id: this.id,
      company_id: this.company_id,
      amount: amountToDeduct,
      type: 'debit',
      reason: description || 'Parcel booking fee',
      reference: reference,
      created_by: userId
    }, { transaction });
    
    console.log('✅ Transaction record created');
    console.log("=".repeat(40));

    return this;
  } catch (error) {
    console.error('❌ Debit error:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};
// In models/Wallet.js
Wallet.prototype.credit = async function(amount, description, reference, userId, transaction) {
  try {
    // FORCE conversion to numbers
    const currentBalance = Number(this.balance) || 0;
    const amountToAdd = Number(amount) || 0;
    
    // Log for debugging
    console.log('=== CREDIT DEBUG ===');
    console.log('Current balance (raw):', this.balance, 'type:', typeof this.balance);
    console.log('Current balance (converted):', currentBalance);
    console.log('Amount to add (raw):', amount, 'type:', typeof amount);
    console.log('Amount to add (converted):', amountToAdd);
    
    // Calculate new balance
    const newBalance = currentBalance + amountToAdd;
    
    console.log('New balance:', newBalance);
    
    // Update wallet with numeric values
    this.balance = newBalance;
    this.total_credits = Number(this.total_credits || 0) + amountToAdd;
    
    await this.save({ transaction });

    // Get the WalletTransaction model
    const WalletTransaction = require('./WalletTransaction');
    
    // Create transaction record
    await WalletTransaction.create({
      wallet_id: this.id,
      company_id: this.company_id,
      amount: amountToAdd, // Store as number
      type: 'credit',
      reason: description,
      reference: reference,
      created_by: userId
    }, { transaction });

    return this;
  } catch (error) {
    console.error('Credit error:', error);
    throw error;
  }
};

Wallet.associate = function(models) {
  Wallet.belongsTo(models.Company, {
    foreignKey: 'company_id',
    as: 'company'
  });
  
  Wallet.hasMany(models.WalletTransaction, {
    foreignKey: 'wallet_id',
    as: 'transactions'
  });
};

module.exports = Wallet;