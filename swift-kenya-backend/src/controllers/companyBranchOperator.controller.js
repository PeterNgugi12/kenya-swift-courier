const companyBranchOperatorService = require('../services/companyBranchOperator.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyBranchOperatorController {
  // Get all operators
  getAllOperators = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const { page = 1, limit = 10, branch_id, status, search } = req.query;
    
    logger.info(`Fetching branch operators for company: ${companyId}`);
    
    const result = await companyBranchOperatorService.getAllOperators(
      companyId,
      { branch_id, status, search },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  // Get operator by ID
  getOperatorById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const operator = await companyBranchOperatorService.getOperatorById(id, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: operator
    });
  });

  // Create new operator
  createOperator = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    logger.info(`Creating new branch operator for company: ${companyId}`);
    
    const operator = await companyBranchOperatorService.createOperator(companyId, req.body, req.user.id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Branch operator created successfully',
      data: operator
    });
  });

  // Update operator
  updateOperator = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const operator = await companyBranchOperatorService.updateOperator(id, companyId, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Operator updated successfully',
      data: operator
    });
  });

  // Update operator status
  updateOperatorStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { is_active } = req.body;
    
    const operator = await companyBranchOperatorService.updateOperatorStatus(id, companyId, is_active);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Operator ${is_active ? 'activated' : 'suspended'} successfully`,
      data: operator
    });
  });

  // Delete operator
  deleteOperator = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    await companyBranchOperatorService.deleteOperator(id, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Operator removed successfully'
    });
  });

  // Reset operator password
  resetPassword = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { password } = req.body;
    
    await companyBranchOperatorService.resetPassword(id, companyId, password);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password reset successfully'
    });
  });

  // Get operator statistics
  getOperatorStats = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const stats = await companyBranchOperatorService.getOperatorStats(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });
}

module.exports = new CompanyBranchOperatorController();