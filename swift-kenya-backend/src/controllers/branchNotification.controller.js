const branchNotificationService = require('../services/branchNotification.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class BranchNotificationController {
  // Get notifications for branch operator
  getNotifications = catchAsync(async (req, res) => {
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    
    logger.info(`Fetching notifications for branch: ${branchId}`);
    
    const notifications = await branchNotificationService.getNotifications(branchId, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: notifications
    });
  });
}

module.exports = new BranchNotificationController();