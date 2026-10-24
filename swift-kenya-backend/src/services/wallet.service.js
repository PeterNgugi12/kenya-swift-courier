const { Wallet, WalletTransaction, Company, User } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize'); // Add this import for operators
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS } = require('../config/constants');

class WalletService {
  async getAllWallets(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const { status, search } = filters;

      const where = {};
      if (status) where.status = status;

      const include = [{
        model: Company,
        as: 'walletCompany',
        attributes: ['id', 'name', 'code', 'status'],
        where: search ? {
          [Op.or]: [  // Now Op is defined
            { name: { [Op.iLike]: `%${search}%` } },
            { code: { [Op.iLike]: `%${search}%` } }
          ]
        } : {},
        required: true
      }];

      const { count, rows } = await Wallet.findAndCountAll({
        where,
        include,
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['balance', 'DESC']],
        distinct: true
      });

      // Transform the data
      const wallets = rows.map(wallet => {
        const walletJson = wallet.toJSON();
        return {
          id: walletJson.id,
          company_id: walletJson.company_id,
          company_name: walletJson.company?.name,
          company_code: walletJson.company?.code,
          balance: parseFloat(walletJson.balance) || 0,
          total_credits: parseFloat(walletJson.total_credits) || 0,
          total_deductions: parseFloat(walletJson.total_deductions) || 0,
          status: walletJson.status,
          low_balance: parseFloat(walletJson.balance) < 500,
          created_at: walletJson.created_at
        };
      });

      logger.debug(`Retrieved ${wallets.length} wallets`);

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: wallets
      };
    } catch (error) {
      logger.error(`Error in getAllWallets: ${error.message}`);
      throw error;
    }
  }

  async getWalletById(walletId) {
    try {
      const wallet = await Wallet.findByPk(walletId, {
        include: [
          {
            model: Company,
            as: 'walletCompany',
            attributes: ['id', 'name', 'code', 'status']
          },
          {
            model: WalletTransaction,
            as: 'walletTransactions',
            limit: 20,
            order: [['created_at', 'DESC']],
            include: [{
              model: User,
              as: 'createdBy',
              attributes: ['id', 'full_name', 'email']
            }]
          }
        ]
      });

      if (!wallet) {
        throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND);
      }

      const walletJson = wallet.toJSON();
      
      return {
        ...walletJson,
        balance: parseFloat(walletJson.balance) || 0,
        total_credits: parseFloat(walletJson.total_credits) || 0,
        total_deductions: parseFloat(walletJson.total_deductions) || 0,
        low_balance: parseFloat(walletJson.balance) < 500
      };
    } catch (error) {
      logger.error(`Error in getWalletById: ${error.message}`);
      throw error;
    }
  }

  async getWalletByCompanyId(companyId) {
    try {
      const wallet = await Wallet.findOne({
        where: { company_id: companyId },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'code', 'status']
          }
        ]
      });

      if (!wallet) {
        throw new AppError('Wallet not found for this company', HTTP_STATUS.NOT_FOUND);
      }

      const walletJson = wallet.toJSON();
      
      return {
        ...walletJson,
        balance: parseFloat(walletJson.balance) || 0,
        total_credits: parseFloat(walletJson.total_credits) || 0,
        total_deductions: parseFloat(walletJson.total_deductions) || 0,
        low_balance: parseFloat(walletJson.balance) < 500
      };
    } catch (error) {
      logger.error(`Error in getWalletByCompanyId: ${error.message}`);
      throw error;
    }
  }
  

  async adjustWalletBalance(walletId, amount, reason, userId) {
    const transaction = await sequelize.transaction();
    
    try {
      const wallet = await Wallet.findByPk(walletId, { transaction });
      if (!wallet) {
        throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND);
      }

      const parsedAmount = parseFloat(amount);
      
      let result;
      if (parsedAmount > 0) {
        // Credit
        result = await wallet.credit(parsedAmount, reason, `ADJ-${Date.now()}`, userId, transaction);
      } else if (parsedAmount < 0) {
        // Debit
        result = await wallet.debit(Math.abs(parsedAmount), reason, `ADJ-${Date.now()}`, userId, transaction);
      } else {
        throw new AppError('Amount must be non-zero', HTTP_STATUS.BAD_REQUEST);
      }

      await transaction.commit();

      logger.info(`Wallet ${walletId} adjusted by ${parsedAmount} by user ${userId}`);

      const walletJson = result.toJSON();
      return {
        id: walletJson.id,
        company_id: walletJson.company_id,
        balance: parseFloat(walletJson.balance) || 0,
        total_credits: parseFloat(walletJson.total_credits) || 0,
        total_deductions: parseFloat(walletJson.total_deductions) || 0,
        status: walletJson.status
      };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in adjustWalletBalance: ${error.message}`);
      throw error;
    }
  }

  async getWalletTransactions(walletId, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;

      const { count, rows } = await WalletTransaction.findAndCountAll({
        where: { wallet_id: walletId },
        include: [
          {
            model: User,
            as: 'createdBy',
            attributes: ['id', 'full_name', 'email']
          }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']]
      });

      const transactions = rows.map(t => ({
        id: t.id,
        amount: parseFloat(t.amount) || 0,
        type: t.type,
        reason: t.reason,
        reference: t.reference,
        created_at: t.created_at,
        created_by: t.createdBy ? {
          id: t.createdBy.id,
          name: t.createdBy.full_name
        } : null
      }));

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: transactions
      };
    } catch (error) {
      logger.error(`Error in getWalletTransactions: ${error.message}`);
      throw error;
    }
  }

  async getPlatformRevenue() {
    try {
      const monthly = await WalletTransaction.findAll({
        where: { type: 'fee_deduction' },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('amount')), 'total_revenue'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_transactions'],
          [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month']
        ],
        group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'DESC']],
        limit: 12,
        raw: true
      });

      const totals = await WalletTransaction.findAll({
        where: { type: 'fee_deduction' },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        raw: true
      });

      const monthlyData = monthly.map(m => ({
        month: m.month,
        revenue: parseFloat(m.total_revenue) || 0,
        transactions: parseInt(m.total_transactions) || 0
      }));

      const totalRevenue = parseFloat(totals[0]?.total) || 0;
      const totalTransactions = parseInt(totals[0]?.count) || 0;

      return {
        total_revenue: totalRevenue,
        total_transactions: totalTransactions,
        monthly: monthlyData,
        ytd: monthlyData.reduce((sum, m) => sum + m.revenue, 0),
        fee_per_parcel: 5
      };
    } catch (error) {
      logger.error(`Error in getPlatformRevenue: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new WalletService();