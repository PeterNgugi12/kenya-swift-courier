const companyDriverService = require('../services/companyDriver.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyDriverController {
  // Get all drivers
  getAllDrivers = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const { page = 1, limit = 10, status, search, branch_id } = req.query;
    
    logger.info(`Fetching drivers for company: ${companyId}`);
    
    const result = await companyDriverService.getAllDrivers(
      companyId,
      { status, search, branch_id },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  // Get driver by ID
  getDriverById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const driver = await companyDriverService.getDriverById(id, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: driver
    });
  });

  // Create new driver
  createDriver = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    logger.info(`Creating new driver for company: ${companyId}`);
    
    const driver = await companyDriverService.createDriver(companyId, req.body, req.user.id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Driver registered successfully',
      data: driver
    });
  });

  // Update driver
  updateDriver = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const driver = await companyDriverService.updateDriver(id, companyId, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Driver updated successfully',
      data: driver
    });
  });

  // Update driver status (including leave)
  updateDriverStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const driver = await companyDriverService.updateDriverStatus(id, companyId, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Driver status updated to ${req.body.status}`,
      data: driver
    });
  });

  // Delete driver
  deleteDriver = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    await companyDriverService.deleteDriver(id, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Driver removed successfully'
    });
  });

  // Get driver statistics
  getDriverStats = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const stats = await companyDriverService.getDriverStats(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });

  // Get available vehicles for assignment
  getAvailableVehicles = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const vehicles = await companyDriverService.getAvailableVehicles(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: vehicles
    });
  });
}

module.exports = new CompanyDriverController();