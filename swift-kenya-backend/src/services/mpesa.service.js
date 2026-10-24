const axios = require('axios');
const { mpesa } = require('../config/mpesa.config');
const { Wallet, WalletTransaction } = require('../models');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger.util');
const AppError = require('../utils/appError.util');
const { Op, DataTypes } = require('sequelize');

class MpesaService {
  constructor() {
    this.environment = mpesa.environment;
    this.baseURL = this.environment === 'sandbox' 
      ? mpesa.urls.sandbox 
      : mpesa.urls.production;
    this.consumerKey = mpesa.consumerKey;
    this.consumerSecret = mpesa.consumerSecret;
    this.passkey = mpesa.passkey;
    this.businessShortCode = mpesa.businessShortCode;
    this.callbackUrl = mpesa.callbackUrl;
    
    // For production, you might need a different shortcode for PartyB
    // Sometimes it's the same as businessShortCode, other times it's a different number
    this.partyB = process.env.MPESA_PARTY_B || this.businessShortCode;
    
    // Transaction type differs based on environment and use case
    this.transactionType = this.determineTransactionType();
  }

  determineTransactionType() {
    // For Paybill: 'CustomerPayBillOnline'
    // For Till: 'CustomerBuyGoodsOnline'
    return 'CustomerPayBillOnline'; // Change if using Till number
  }

  // Generate access token
  async getAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      logger.info(`Getting M-Pesa access token from ${this.environment} environment`);
      
      const response = await axios.get(this.baseURL.auth, {
        headers: {
          Authorization: `Basic ${auth}`
        },
        timeout: 30000 // 30 seconds timeout
      });

      logger.info('M-Pesa access token obtained successfully');
      return response.data.access_token;
    } catch (error) {
      this.logError('M-Pesa access token error:', error);
      throw new AppError(`Failed to get M-Pesa access token: ${error.message}`, 500);
    }
  }

  // Generate timestamp
  getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  // Generate password
  generatePassword(timestamp) {
    const str = `${this.businessShortCode}${this.passkey}${timestamp}`;
    return Buffer.from(str).toString('base64');
  }

  // Format phone number (254XXXXXXXXX)
  formatPhoneNumber(phone) {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1);
    }
    // If starts with 7, add 254
    else if (cleaned.startsWith('7')) {
      cleaned = '254' + cleaned;
    }
    // If starts with 254, keep as is
    
    // Validate length (should be 12 digits: 254 + 9 digits)
    if (cleaned.length !== 12) {
      throw new AppError('Invalid phone number format. Must be a valid Kenyan number', 400);
    }
    
    return cleaned;
  }

  // Validate amount
  validateAmount(amount) {
    const minAmount = this.environment === 'production' ? 10 : 1;
    const maxAmount = 150000; // M-Pesa max is 150,000 KES
    
    if (amount < minAmount) {
      throw new AppError(`Amount must be at least ${minAmount} KES`, 400);
    }
    if (amount > maxAmount) {
      throw new AppError(`Amount cannot exceed ${maxAmount} KES`, 400);
    }
    return Math.floor(amount);
  }

  // Initiate STK Push
  async stkPush(phoneNumber, amount, accountReference, transactionDesc, companyId, userId) {
    try {
      // Validate inputs
      const validAmount = this.validateAmount(amount);
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Get access token
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(timestamp);

      const requestBody = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: this.transactionType,
        Amount: validAmount,
        PartyA: formattedPhone,
        PartyB: this.partyB,
        PhoneNumber: formattedPhone,
        CallBackURL: this.callbackUrl,
        AccountReference: (accountReference || 'WalletTopup').substring(0, 12), // Max 12 chars
        TransactionDesc: (transactionDesc || 'Wallet top-up').substring(0, 13) // Max 13 chars
      };

      logger.info('M-Pesa STK Push Request:', { 
        environment: this.environment,
        phone: formattedPhone, 
        amount: validAmount, 
        accountReference: requestBody.AccountReference
      });

      const response = await axios.post(this.baseURL.stkPush, requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // Log full response in development only
      if (this.environment === 'sandbox') {
        logger.info('M-Pesa STK Push Response:', response.data);
      }

      // Store the pending transaction if successful
      if (response.data.ResponseCode === '0') {
        await this.storePendingTransaction({
          checkoutRequestID: response.data.CheckoutRequestID,
          merchantRequestID: response.data.MerchantRequestID,
          amount: validAmount,
          phoneNumber: formattedPhone,
          accountReference: requestBody.AccountReference,
          companyId,
          userId,
          status: 'pending'
        });
      }

      return {
        success: response.data.ResponseCode === '0',
        message: response.data.ResponseDescription || 'STK Push sent',
        checkoutRequestID: response.data.CheckoutRequestID,
        merchantRequestID: response.data.MerchantRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription
      };
    } catch (error) {
      this.logError('M-Pesa STK Push error:', error);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new AppError(
          `M-Pesa payment failed: ${error.response.data.errorMessage || 'Unknown error'}`,
          error.response.status || 500
        );
      } else if (error.request) {
        // The request was made but no response was received
        throw new AppError('M-Pesa service is unavailable. Please try again later.', 503);
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new AppError(`Failed to initiate M-Pesa payment: ${error.message}`, 500);
      }
    }
  }

  // Store pending transaction
  async storePendingTransaction(data) {
    try {
      // Define model if not already defined
      const MpesaTransaction = sequelize.isDefined('MpesaTransaction') 
        ? sequelize.model('MpesaTransaction')
        : sequelize.define('MpesaTransaction', {
            checkoutRequestID: { type: DataTypes.STRING, primaryKey: true },
            merchantRequestID: DataTypes.STRING,
            amount: DataTypes.DECIMAL(10, 2),
            phoneNumber: DataTypes.STRING,
            accountReference: DataTypes.STRING,
            companyId: DataTypes.UUID,
            userId: DataTypes.UUID,
            status: DataTypes.STRING,
            resultCode: DataTypes.INTEGER,
            resultDesc: DataTypes.TEXT,
            mpesaReceiptNumber: DataTypes.STRING,
            transactionDate: DataTypes.DATE
          }, { tableName: 'mpesa_transactions' });

      await MpesaTransaction.create(data);
      logger.info(`M-Pesa pending transaction stored: ${data.checkoutRequestID}`);
    } catch (error) {
      logger.error('Error storing M-Pesa transaction:', error);
      // Don't throw - we don't want to fail the payment if storage fails
    }
  }

  // Handle M-Pesa callback
  async handleCallback(callbackData) {
    const transaction = await sequelize.transaction();

    try {
      const { Body } = callbackData;
      const { stkCallback } = Body;
      
      const {
        MerchantRequestID,
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata
      } = stkCallback;

      logger.info('M-Pesa Callback Received:', { 
        CheckoutRequestID, 
        ResultCode, 
        ResultDesc 
      });

      // Get the MpesaTransaction model
      const MpesaTransaction = sequelize.model('MpesaTransaction');
      
      // Find the pending transaction
      const pendingTxn = await MpesaTransaction.findOne({
        where: { checkoutRequestID: CheckoutRequestID }
      });

      if (!pendingTxn) {
        logger.error('M-Pesa: Pending transaction not found', { CheckoutRequestID });
        await transaction.rollback();
        return { success: false, error: 'Transaction not found' };
      }

      // Update transaction record
      const updateData = {
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        status: ResultCode === 0 ? 'completed' : 'failed'
      };

      // If payment successful, extract metadata and credit wallet
      if (ResultCode === 0 && CallbackMetadata) {
        const metadata = this.parseCallbackMetadata(CallbackMetadata);
        updateData.mpesaReceiptNumber = metadata.MpesaReceiptNumber;
        updateData.transactionDate = metadata.TransactionDate;
        
        // Credit the company wallet
        const wallet = await Wallet.findOne({
          where: { company_id: pendingTxn.companyId }
        });

        if (wallet) {
          await wallet.credit(
            pendingTxn.amount,
            `M-Pesa top-up: ${metadata.MpesaReceiptNumber}`,
            metadata.MpesaReceiptNumber,
            pendingTxn.userId,
            transaction
          );
          
          logger.info(`Wallet credited: KES ${pendingTxn.amount} for company ${pendingTxn.companyId}`);
        } else {
          logger.error(`Wallet not found for company: ${pendingTxn.companyId}`);
        }
      }

      await pendingTxn.update(updateData, { transaction });
      await transaction.commit();

      return { success: true };
    } catch (error) {
      await transaction.rollback();
      logger.error('M-Pesa callback handling error:', error);
      throw error;
    }
  }

  // Parse callback metadata
  parseCallbackMetadata(metadata) {
    const items = metadata.Item || [];
    const result = {};
    items.forEach(item => {
      result[item.Name] = item.Value;
    });
    return result;
  }

  // Query transaction status
// In your MpesaService class, update the queryStatus method
async queryStatus(checkoutRequestID) {
  try {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = this.generatePassword(timestamp);

    const requestBody = {
      BusinessShortCode: this.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID
    };

    logger.info('Querying M-Pesa status:', { 
      checkoutRequestID,
      businessShortCode: this.businessShortCode 
    });

    const response = await axios.post(this.baseURL.query, requestBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Log the response for debugging
    logger.info('M-Pesa query response:', {
      ResponseCode: response.data.ResponseCode,
      ResultCode: response.data.ResultCode,
      ResultDesc: response.data.ResultDesc
    });

    // IMPORTANT: Update the transaction in database
    if (response.data) {
      await this.updateTransactionFromQuery(checkoutRequestID, response.data);
    }

    // Return a standardized response
    return {
      success: response.data.ResponseCode === '0',
      completed: response.data.ResultCode === '0',
      failed: response.data.ResultCode !== '0' && response.data.ResultCode !== undefined,
      pending: response.data.ResultCode === undefined || response.data.ResultCode === null,
      data: {
        checkoutRequestID: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
        amount: response.data.Amount,
        mpesaReceiptNumber: response.data.MpesaReceiptNumber,
        transactionDate: response.data.TransactionDate,
        phoneNumber: response.data.PhoneNumber
      }
    };
  } catch (error) {
    this.logError('M-Pesa query error:', error);
    
    // Handle specific error cases
    if (error.response) {
      logger.error('M-Pesa query error response:', {
        status: error.response.status,
        data: error.response.data
      });
      
      return {
        success: false,
        completed: false,
        failed: true,
        pending: false,
        data: {
          checkoutRequestID,
          responseCode: error.response.data?.errorCode || '500',
          resultCode: '500',
          resultDesc: error.response.data?.errorMessage || 'Failed to query payment status',
          error: true
        }
      };
    } else if (error.request) {
      logger.error('M-Pesa query no response:', error.request);
      return {
        success: false,
        completed: false,
        failed: false,
        pending: true,
        data: {
          checkoutRequestID,
          resultDesc: 'Payment status query timed out. Please check back later.',
          pending: true
        }
      };
    } else {
      logger.error('M-Pesa query error:', error.message);
      return {
        success: false,
        completed: false,
        failed: true,
        pending: false,
        data: {
          checkoutRequestID,
          resultDesc: error.message || 'Failed to query payment status',
          error: true
        }
      };
    }
  }
}

// Add this new method to update transaction from query
async updateTransactionFromQuery(checkoutRequestID, queryData) {
  try {
    const MpesaTransaction = this.getMpesaTransactionModel();
    
    const transaction = await MpesaTransaction.findOne({
      where: { checkoutRequestID }
    });

    if (!transaction) {
      logger.error(`Transaction not found for query update: ${checkoutRequestID}`);
      return;
    }

    const updateData = {
      resultCode: queryData.ResultCode,
      resultDesc: queryData.ResultDesc,
      updated_at: new Date()
    };

    // If transaction is complete (ResultCode 0)
    if (queryData.ResultCode === 0) {
      updateData.status = 'completed';
      updateData.mpesaReceiptNumber = queryData.MpesaReceiptNumber;
      updateData.transactionDate = queryData.TransactionDate;
      
      // Credit the wallet if not already credited
      if (transaction.status !== 'completed') {
        await this.creditWalletFromTransaction(transaction, queryData);
      }
    }
    // If transaction failed/cancelled (ResultCode other than 0)
    else if (queryData.ResultCode && queryData.ResultCode !== 0) {
      updateData.status = queryData.ResultCode === 1032 ? 'cancelled' : 'failed';
    }

    await transaction.update(updateData);
    logger.info(`Updated transaction ${checkoutRequestID} to ${updateData.status || 'updated'}`);
    
  } catch (error) {
    logger.error('Error updating transaction from query:', error);
  }
}

// Add method to credit wallet
// In MpesaService.js - update creditWalletFromTransaction
async creditWalletFromTransaction(transaction, queryData) {
  const dbTransaction = await sequelize.transaction();
  
  try {
    const wallet = await Wallet.findOne({
      where: { company_id: transaction.companyId }
    });

    if (wallet) {
      // ENSURE amount is a number, not a string
      const amountToAdd = Number(transaction.amount);
      
      console.log('M-Pesa credit:', {
        amountFromDB: transaction.amount,
        amountType: typeof transaction.amount,
        amountToAdd,
        amountToAddType: typeof amountToAdd
      });
      
      await wallet.credit(
        amountToAdd, // Pass as number
        `M-Pesa top-up: ${queryData.MpesaReceiptNumber || 'MPESA'}`,
        queryData.MpesaReceiptNumber || transaction.checkoutRequestID,
        transaction.userId,
        dbTransaction
      );
      
      await dbTransaction.commit();
      logger.info(`Wallet credited: KES ${amountToAdd} for company ${transaction.companyId}`);
    }
  } catch (error) {
    await dbTransaction.rollback();
    throw error;
  }
}

// Helper to get MpesaTransaction model
getMpesaTransactionModel() {
  if (sequelize.isDefined('MpesaTransaction')) {
    return sequelize.model('MpesaTransaction');
  }
  
  return sequelize.define('MpesaTransaction', {
    checkoutRequestID: { 
      type: DataTypes.STRING, 
      primaryKey: true,
      field: 'checkout_request_i_d'
    },
    merchantRequestID: { 
      type: DataTypes.STRING,
      field: 'merchant_request_i_d'
    },
    amount: { type: DataTypes.DECIMAL(10, 2) },
    phoneNumber: { 
      type: DataTypes.STRING,
      field: 'phone_number'
    },
    accountReference: { 
      type: DataTypes.STRING,
      field: 'account_reference'
    },
    companyId: { 
      type: DataTypes.UUID,
      field: 'company_id'
    },
    userId: { 
      type: DataTypes.UUID,
      field: 'user_id'
    },
    status: DataTypes.STRING,
    resultCode: { 
      type: DataTypes.INTEGER,
      field: 'result_code'
    },
    resultDesc: { 
      type: DataTypes.TEXT,
      field: 'result_desc'
    },
    mpesaReceiptNumber: { 
      type: DataTypes.STRING,
      field: 'mpesa_receipt_number'
    },
    transactionDate: { 
      type: DataTypes.DATE,
      field: 'transaction_date'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at'
    }
  }, { 
    tableName: 'mpesa_transactions',
    timestamps: true,
    underscored: true
  });
}
// Add this method to clean up stale pending transactions
async cleanupStaleTransactions() {
  try {
    const MpesaTransaction = this.getMpesaTransactionModel();
    
    // Find transactions pending for more than 30 minutes
    const staleTime = new Date();
    staleTime.setMinutes(staleTime.getMinutes() - 30);

    const staleTransactions = await MpesaTransaction.findAll({
      where: {
        status: 'pending',
        createdAt: { [Op.lt]: staleTime }
      }
    });

    logger.info(`Found ${staleTransactions.length} stale transactions to clean up`);

    for (const transaction of staleTransactions) {
      try {
        // Query current status
        const status = await this.queryStatus(transaction.checkoutRequestID);
        
        if (status.completed) {
          logger.info(`Stale transaction ${transaction.checkoutRequestID} completed`);
        } else if (status.failed) {
          await transaction.update({
            status: 'failed',
            resultDesc: 'Transaction timeout - no confirmation received',
            updatedAt: new Date()
          });
          logger.info(`Marked stale transaction ${transaction.checkoutRequestID} as failed`);
        }
      } catch (error) {
        logger.error(`Failed to cleanup transaction ${transaction.checkoutRequestID}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error in cleanupStaleTransactions:', error);
  }
}

  // Helper method to log errors
  logError(message, error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack
    };

    if (error.response) {
      errorDetails.response = {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      };
    } else if (error.request) {
      errorDetails.request = {
        method: error.request.method,
        path: error.request.path,
        host: error.request.host
      };
    }

    logger.error(message, errorDetails);
  }
}

module.exports = new MpesaService();