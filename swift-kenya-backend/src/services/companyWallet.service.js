const { Wallet, WalletTransaction, Company,User } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS } = require('../config/constants');
const mpesaService = require('./mpesa.service');

class CompanyWalletService {
  // Get wallet by company ID
  async getWallet(companyId) {
    try {
      const wallet = await Wallet.findOne({
        where: { company_id: companyId },
        include: [{
          model: Company,
          as: 'walletCompany',
          attributes: ['id', 'name', 'code']
        }]
      });

      if (!wallet) {
        throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND);
      }

      return {
        id: wallet.id,
        company_id: wallet.company_id,
        balance: parseFloat(wallet.balance),
        total_credits: parseFloat(wallet.total_credits),
        total_deductions: parseFloat(wallet.total_deductions),
        status: wallet.status,
        low_balance: parseFloat(wallet.balance) < 500
      };
    } catch (error) {
      logger.error(`Error in getWallet: ${error.message}`);
      throw error;
    }
  }

  // Get wallet transactions
  async getTransactions(companyId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const { type, search, start_date, end_date } = filters;

      const where = { company_id: companyId };
      
      if (type && type !== 'all') where.type = type;
      
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at[Op.gte] = new Date(start_date);
        if (end_date) where.created_at[Op.lte] = new Date(end_date);
      }

      const { count, rows } = await WalletTransaction.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']],
        include: [{
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'full_name', 'email']
        }]
      });

      // Get current wallet balance for running balance calculation
      const wallet = await Wallet.findOne({ where: { company_id: companyId } });
      let runningBalance = parseFloat(wallet.balance);

      // Calculate running balance for each transaction
      const transactions = rows.reverse().map(t => {
        const tJson = t.toJSON();
        const amount = parseFloat(tJson.amount);
        
        if (tJson.type === 'credit') {
          runningBalance -= amount;
        } else {
          runningBalance += amount;
        }

        return {
          id: tJson.id,
          amount: tJson.type === 'credit' ? amount : -amount,
          type: tJson.type,
          reason: tJson.reason,
          reference: tJson.reference,
          balance_after: runningBalance,
          created_at: tJson.created_at,
          created_by: tJson.createdByUser
        };
      }).reverse();

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: transactions
      };
    } catch (error) {
      logger.error(`Error in getTransactions: ${error.message}`);
      throw error;
    }
  }

  // Initiate M-Pesa top-up
  async initiateMpesaTopUp(companyId, data, userId) {
    try {
      const { amount, phone_number } = data;

      if (amount < 10) {
        throw new AppError('Minimum top-up amount is KES 10', HTTP_STATUS.BAD_REQUEST);
      }

      if (amount > 150000) {
        throw new AppError('Maximum top-up amount is KES 150,000', HTTP_STATUS.BAD_REQUEST);
      }

      // Get company details for reference
      const company = await Company.findByPk(companyId);
      
      const accountReference = `WALLET-${company.code}-${Date.now().toString().slice(-6)}`;
      const transactionDesc = `Wallet top-up for ${company.name}`;

      // Initiate STK Push
      const result = await mpesaService.stkPush(
        phone_number,
        amount,
        accountReference,
        transactionDesc,
        companyId,
        userId
      );

      return result;
    } catch (error) {
      logger.error(`Error in initiateMpesaTopUp: ${error.message}`);
      throw error;
    }
  }

  // Get wallet statistics
  async getStats(companyId) {
    try {
      const wallet = await Wallet.findOne({
        where: { company_id: companyId },
        attributes: ['balance', 'total_credits', 'total_deductions']
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      // Today's transactions
      const todayStats = await WalletTransaction.findAll({
        where: {
          company_id: companyId,
          created_at: { [Op.gte]: today }
        },
        attributes: [
          [sequelize.fn('SUM', 
            sequelize.literal("CASE WHEN type = 'credit' THEN amount ELSE 0 END")
          ), 'credits'],
          [sequelize.fn('SUM', 
            sequelize.literal("CASE WHEN type IN ('debit', 'fee_deduction') THEN amount ELSE 0 END")
          ), 'debits'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        raw: true
      });

      // This month's transactions
      const monthStats = await WalletTransaction.findAll({
        where: {
          company_id: companyId,
          created_at: { [Op.gte]: thisMonth }
        },
        attributes: [
          [sequelize.fn('SUM', 
            sequelize.literal("CASE WHEN type = 'credit' THEN amount ELSE 0 END")
          ), 'credits'],
          [sequelize.fn('SUM', 
            sequelize.literal("CASE WHEN type IN ('debit', 'fee_deduction') THEN amount ELSE 0 END")
          ), 'debits']
        ],
        raw: true
      });

      return {
        balance: parseFloat(wallet?.balance) || 0,
        total_credits: parseFloat(wallet?.total_credits) || 0,
        total_deductions: parseFloat(wallet?.total_deductions) || 0,
        today: {
          credits: parseFloat(todayStats[0]?.credits) || 0,
          debits: parseFloat(todayStats[0]?.debits) || 0,
          count: parseInt(todayStats[0]?.count) || 0
        },
        this_month: {
          credits: parseFloat(monthStats[0]?.credits) || 0,
          debits: parseFloat(monthStats[0]?.debits) || 0
        }
      };
    } catch (error) {
      logger.error(`Error in getStats: ${error.message}`);
      throw error;
    }
  }

  // Add this method to companyWallet.service.js

/**
 * Check M-Pesa payment status
 * @param {string} checkoutRequestId - M-Pesa checkout request ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Payment status
 */
// In companyWallet.service.js
async checkMpesaPaymentStatus(checkoutRequestId, companyId) {
  try {
    // Get M-Pesa service instance
    const mpesaService = require('./mpesa.service');
    
    // Query M-Pesa for current status
    const mpesaStatus = await mpesaService.queryStatus(checkoutRequestId);
    
    // Check local database for transaction
    const { sequelize } = require('../config/database');
    let localTransaction = null;
    
    try {
      const MpesaTransaction = sequelize.model('MpesaTransaction');
      localTransaction = await MpesaTransaction.findOne({
        where: { 
          checkoutRequestID: checkoutRequestId,
          companyId 
        }
      });
    } catch (dbError) {
      logger.warn('Could not fetch local transaction:', dbError.message);
      // Table might not exist yet
    }

    // Determine status based on both sources
    let status = 'pending';
    let message = 'Payment is being processed';
    
    if (mpesaStatus.completed) {
      status = 'completed';
      message = mpesaStatus.data.resultDesc || 'Payment completed successfully';
    } else if (mpesaStatus.failed) {
      status = 'failed';
      message = mpesaStatus.data.resultDesc || 'Payment failed';
    } else if (localTransaction?.status) {
      status = localTransaction.status;
      message = localTransaction.resultDesc || message;
    }

    return {
      success: true,
      checkoutRequestID: checkoutRequestId,
      status,
      message,
      mpesaResponse: mpesaStatus,
      localTransaction: localTransaction ? {
        amount: localTransaction.amount,
        phoneNumber: localTransaction.phoneNumber,
        accountReference: localTransaction.accountReference,
        resultCode: localTransaction.resultCode,
        resultDesc: localTransaction.resultDesc,
        mpesaReceiptNumber: localTransaction.mpesaReceiptNumber,
        transactionDate: localTransaction.transactionDate
      } : null
    };
  } catch (error) {
    logger.error('Error checking M-Pesa status:', error);
    
    // Return a graceful error response instead of throwing
    return {
      success: false,
      checkoutRequestID: checkoutRequestId,
      status: 'unknown',
      message: error.message || 'Failed to check payment status',
      error: true
    };
  }
}
}

module.exports = new CompanyWalletService();