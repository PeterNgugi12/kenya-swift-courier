const companyDashboardService = require('../services/companyDashboard.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyDashboardController {
  // Get all dashboard stats
  getDashboardStats = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    logger.info(`Fetching dashboard stats for company: ${companyId}`);
    
    const stats = await companyDashboardService.getDashboardStats(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });

  // Get weekly data
  getWeeklyData = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const data = await companyDashboardService.getWeeklyData(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data
    });
  });

  // Get branch performance
  getBranchPerformance = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const data = await companyDashboardService.getBranchPerformance(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data
    });
  });

  // Get recent trips
  getRecentTrips = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const data = await companyDashboardService.getRecentTrips(companyId);
    
    const activeCount = data.filter(t => 
      t.status === 'in_transit' || t.status === 'departed'
    ).length;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data,
      active_count: activeCount
    });
  });

  // Get wallet info
  getWalletInfo = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const data = await companyDashboardService.getWalletInfo(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data
    });
  });
}

module.exports = new CompanyDashboardController();