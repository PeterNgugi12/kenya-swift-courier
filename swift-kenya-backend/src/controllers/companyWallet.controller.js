const companyWalletService = require('../services/companyWallet.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyWalletController {
  // Get wallet info
  getWallet = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    logger.info(`Fetching wallet for company: ${companyId}`);
    
    const wallet = await companyWalletService.getWallet(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: wallet
    });
  });

  // Get transactions
  getTransactions = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const { page = 1, limit = 20, type, search, start_date, end_date } = req.query;
    
    const result = await companyWalletService.getTransactions(
      companyId,
      { type, search, start_date, end_date },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  // Initiate M-Pesa top-up
  initiateMpesaTopUp = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    
    logger.info(`Initiating M-Pesa top-up for company: ${companyId}`);
    
    const result = await companyWalletService.initiateMpesaTopUp(companyId, req.body, userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'STK Push sent. Please check your phone to complete payment.',
      data: result
    });
  });

  // Check M-Pesa payment status
  checkMpesaStatus = catchAsync(async (req, res) => {
    const { checkoutRequestId } = req.params;
    const companyId = req.user.company_id;
    
    logger.info(`Checking M-Pesa status for: ${checkoutRequestId}`);
    
    const status = await companyWalletService.checkMpesaPaymentStatus(
      checkoutRequestId,
      companyId
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: status
    });
  });

  // Get wallet statistics
  getStats = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const stats = await companyWalletService.getStats(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });
}

module.exports = new CompanyWalletController();