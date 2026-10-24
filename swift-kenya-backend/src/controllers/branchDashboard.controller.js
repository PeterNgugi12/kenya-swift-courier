const branchDashboardService = require('../services/branchDashboard.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class BranchDashboardController {
  // Get dashboard statistics
  getStats = catchAsync(async (req, res) => {
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    
    logger.info(`Fetching dashboard stats for branch: ${branchId}`);
    
    const stats = await branchDashboardService.getStats(branchId, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });

  // Get recent parcels
  getRecentParcels = catchAsync(async (req, res) => {
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    const { limit = 10 } = req.query;
    
    const parcels = await branchDashboardService.getRecentParcels(branchId, companyId, parseInt(limit));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: parcels
    });
  });

  // Get branch info
  getBranchInfo = catchAsync(async (req, res) => {
    const branchId = req.user.branch_id;
    
    const info = await branchDashboardService.getBranchInfo(branchId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: info
    });
  });

  // Get overdue alerts
  getOverdueAlerts = catchAsync(async (req, res) => {
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    
    const alerts = await branchDashboardService.getOverdueAlerts(branchId, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: alerts
    });
  });
}

module.exports = new BranchDashboardController();