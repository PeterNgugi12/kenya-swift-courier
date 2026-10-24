const dashboardService = require('../services/dashboard.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');

class DashboardController {
  getPlatformStats = catchAsync(async (req, res) => {
    const stats = await dashboardService.getPlatformStats();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });

  getMonthlyTrends = catchAsync(async (req, res) => {
    const trends = await dashboardService.getMonthlyTrends();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: trends
    });
  });

  getSystemAlerts = catchAsync(async (req, res) => {
    const alerts = await dashboardService.getSystemAlerts();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: alerts
    });
  });
}

module.exports = new DashboardController();