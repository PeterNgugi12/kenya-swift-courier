const companyService = require('../services/company.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyController {
  createCompany = catchAsync(async (req, res) => {
    logger.info('Creating new company');
    
    // Add logo URL if file was uploaded
    const data = { ...req.body };
    if (req.file) {
      data.logo_url = `/uploads/${req.file.filename}`;
    }
    
    const company = await companyService.createCompany(data, req.user.id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  });

  getAllCompanies = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const result = await companyService.getAllCompanies(
      { status, search },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  getCompanyById = catchAsync(async (req, res) => {
    const { id } = req.params;
    
    const company = await companyService.getCompanyById(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: company
    });
  });

  updateCompany = catchAsync(async (req, res) => {
    const { id } = req.params;
    
    const company = await companyService.updateCompany(id, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  });

  updateCompanyStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const company = await companyService.updateCompanyStatus(id, status);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Company status updated to ${status}`,
      data: company
    });
  });

  getCompanyStats = catchAsync(async (req, res) => {
    const { id } = req.params;
    
    const stats = await companyService.getCompanyStats(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });
}

module.exports = new CompanyController();