const analyticsService = require('../services/analytics.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');

class AnalyticsController {
  // Get company comparison data
  getCompanyComparison = catchAsync(async (req, res) => {
    const { months = 6 } = req.query;
    
    const data = await analyticsService.getCompanyComparison(parseInt(months));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data
    });
  });

  // Get market share data
  getMarketShare = catchAsync(async (req, res) => {
    const data = await analyticsService.getMarketShare();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data
    });
  });
}

module.exports = new AnalyticsController();