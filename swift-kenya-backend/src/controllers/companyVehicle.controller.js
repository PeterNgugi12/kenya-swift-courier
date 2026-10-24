const companyVehicleService = require('../services/companyVehicle.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');

class CompanyVehicleController {
  // Get all vehicles
  getAllVehicles = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const { page = 1, limit = 10, status, search, branch_id } = req.query;
    
    logger.info(`Fetching vehicles for company: ${companyId}`);
    
    const result = await companyVehicleService.getAllVehicles(
      companyId,
      { status, search, branch_id },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  // Get vehicle by ID
  getVehicleById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const vehicle = await companyVehicleService.getVehicleById(id, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: vehicle
    });
  });

  // Create new vehicle
  createVehicle = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    logger.info(`Creating new vehicle for company: ${companyId}`);
    
    const vehicle = await companyVehicleService.createVehicle(companyId, req.body, req.user.id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Vehicle registered successfully',
      data: vehicle
    });
  });

  // Update vehicle
  updateVehicle = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const vehicle = await companyVehicleService.updateVehicle(id, companyId, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Vehicle updated successfully',
      data: vehicle
    });
  });

  // Update vehicle status
  updateVehicleStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const vehicle = await companyVehicleService.updateVehicleStatus(id, companyId, req.body);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Vehicle status updated to ${req.body.status}`,
      data: vehicle
    });
  });

  // Delete vehicle (mark as sold)
  deleteVehicle = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { notes } = req.body;
    
    await companyVehicleService.deleteVehicle(id, companyId, notes);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Vehicle removed from fleet successfully'
    });
  });

  // Get vehicle statistics
  getVehicleStats = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const stats = await companyVehicleService.getVehicleStats(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });

  // Assign driver to vehicle
  assignDriver = catchAsync(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { driver_id, driver_name } = req.body;
    
    const vehicle = await companyVehicleService.assignDriver(id, companyId, driver_id, driver_name);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Driver assigned successfully',
      data: vehicle
    });
  });
}

module.exports = new CompanyVehicleController();