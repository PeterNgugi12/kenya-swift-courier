const mpesaService = require('../services/mpesa.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class MpesaController {
  // Handle M-Pesa callback
  handleCallback = catchAsync(async (req, res) => {
    logger.info('M-Pesa callback received');
    
    await mpesaService.handleCallback(req.body);

    // Always return success to M-Pesa
    res.status(HTTP_STATUS.OK).json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });
  });

  // Handle timeout
  handleTimeout = catchAsync(async (req, res) => {
    logger.warn('M-Pesa timeout received');
    
    res.status(HTTP_STATUS.OK).json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });
  });

  // Query transaction status
  queryStatus = catchAsync(async (req, res) => {
    const { checkoutRequestID } = req.params;
    
    const result = await mpesaService.queryStatus(checkoutRequestID);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });
}

module.exports = new MpesaController();