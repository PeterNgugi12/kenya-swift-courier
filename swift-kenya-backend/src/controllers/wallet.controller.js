const walletService = require('../services/wallet.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class WalletController {
  getAllWallets = catchAsync(async (req, res) => {
    const { page, limit, status, search } = req.query;
    
    const result = await walletService.getAllWallets(
      { status, search },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  getWalletById = catchAsync(async (req, res) => {
    const { id } = req.params;
    
    const wallet = await walletService.getWalletById(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: wallet
    });
  });

  getWalletByCompanyId = catchAsync(async (req, res) => {
    const { companyId } = req.params;
    
    const wallet = await walletService.getWalletByCompanyId(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: wallet
    });
  });

  adjustWalletBalance = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { amount, reason } = req.body;
    
    const wallet = await walletService.adjustWalletBalance(id, amount, reason, req.user.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Wallet balance adjusted successfully',
      data: wallet
    });
  });

  getWalletTransactions = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { page, limit } = req.query;
    
    const transactions = await walletService.getWalletTransactions(id, { page, limit });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: transactions
    });
  });

  getPlatformRevenue = catchAsync(async (req, res) => {
    const revenue = await walletService.getPlatformRevenue();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: revenue
    });
  });
}

module.exports = new WalletController();