const companyReportsService = require('../services/companyReports.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyReportsController {
  // Get report summary
  getSummary = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const { start_date, end_date } = req.query;
    
    logger.info(`Fetching reports summary for company: ${companyId}`);
    
    const summary = await companyReportsService.getSummary(companyId, { start_date, end_date });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary
    });
  });

  // Get monthly breakdown
  getMonthlyBreakdown = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const { start_date, end_date } = req.query;
    
    const data = await companyReportsService.getMonthlyBreakdown(companyId, { start_date, end_date });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data
    });
  });

  // Export report
  exportReport = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const companyName = req.user.company_name || 'Company';
    const { format = 'pdf', start_date, end_date } = req.query;

    logger.info(`Exporting ${format} report for company: ${companyId}`);

    if (format === 'pdf') {
      const pdfBuffer = await companyReportsService.generatePDF(companyId, companyName, { start_date, end_date });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report-${Date.now()}.pdf`);
      res.send(pdfBuffer);
    } else if (format === 'csv') {
      const csvData = await companyReportsService.generateCSV(companyId, { start_date, end_date });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report-${Date.now()}.csv`);
      res.send(csvData);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid format. Use pdf or csv'
      });
    }
  });
}

module.exports = new CompanyReportsController();