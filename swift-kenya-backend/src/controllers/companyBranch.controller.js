const companyBranchService = require('../services/companyBranch.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyBranchController {
  // Get all branches for the company
  getAllBranches = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const { page = 1, limit = 10, status, search } = req.query;
    
    logger.info(`Fetching branches for company: ${companyId}`);
    
    const result = await companyBranchService.getAllBranches(
      companyId,
      { status, search },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  // Get branch by ID
  getBranchById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const branch = await companyBranchService.getBranchById(id, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: branch
    });
  });

  // Create new branch
  createBranch = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    logger.info(`Creating new branch for company: ${companyId}`);
    
    const branch = await companyBranchService.createBranch(companyId, req.body, req.user.id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Branch created successfully',
      data: branch
    });
  });

  // Update branch
  updateBranch = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const branch = await companyBranchService.updateBranch(id, companyId, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Branch updated successfully',
      data: branch
    });
  });

  // Update branch status
  updateBranchStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { status } = req.body;
    
    const branch = await companyBranchService.updateBranchStatus(id, companyId, status);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Branch status updated to ${status}`,
      data: branch
    });
  });

  // Delete branch
  deleteBranch = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    await companyBranchService.deleteBranch(id, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Branch deleted successfully'
    });
  });
}

module.exports = new CompanyBranchController();