const smsService = require('../services/sms.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class SMSController {
  getSMSLogs = catchAsync(async (req, res) => {
    const { page, limit, status, company_id, from_date, to_date } = req.query;
    
    const logs = await smsService.getSMSLogs(
      { status, company_id, from_date, to_date },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: logs
    });
  });

  getSMSStats = catchAsync(async (req, res) => {
    const stats = await smsService.getSMSStats();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });

  resendFailedSMS = catchAsync(async (req, res) => {
    const { id } = req.params;
    
    const sms = await smsService.resendFailedSMS(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'SMS resent successfully',
      data: sms
    });
  });
}

module.exports = new SMSController();