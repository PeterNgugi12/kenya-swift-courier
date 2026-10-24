const { Vehicle, Driver, Branch } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS, ROLES } = require('../config/constants');

class CompanyVehicleService {
  // Get all vehicles for a company
  async getAllVehicles(companyId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const { status, search, branch_id } = filters;

      const where = { company_id: companyId };
      
      if (status && status !== 'all') where.status = status;
      if (branch_id) where.branch_id = branch_id;
      
      if (search) {
        where[Op.or] = [
          { plate_number: { [Op.iLike]: `%${search}%` } },
          { type: { [Op.iLike]: `%${search}%` } },
          { driver_name: { [Op.iLike]: `%${search}%` } },
          { route: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows } = await Vehicle.findAndCountAll({
        where,
        include: [
          {
            model: Driver,
            as: 'vehicleDriver',
            attributes: ['id', 'name', 'phone', 'license_number'],
            required: false
          },
          {
            model: Branch,
            as: 'vehicleBranch',
            attributes: ['id', 'name', 'code', 'town'],
            required: false
          }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']]
      });

      // Transform data for frontend
    // Transform data for frontend
const vehicles = rows.map(v => {
  const vehicle = v.toJSON();
  return {
    id: vehicle.id,
    plate: vehicle.plate_number,  // Make sure this matches your column name
    type: vehicle.type,
    route: vehicle.route || 'Not assigned',
    driver: vehicle.driver_name || (vehicle.vehicleDriver?.name) || 'Unassigned',
    driver_id: vehicle.driver_id,
    capacity: vehicle.capacity,
    capacity_unit: vehicle.capacity_unit,
    status: vehicle.status,
    trips: vehicle.total_trips || 0,
    parcels: vehicle.total_parcels || 0,
    branch: vehicle.vehicleBranch,
    last_maintenance: vehicle.last_maintenance,
    next_maintenance: vehicle.next_maintenance
  };
});

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: vehicles
      };
    } catch (error) {
      logger.error(`Error in getAllVehicles: ${error.message}`);
      throw error;
    }
  }

  // Get vehicle by ID
  async getVehicleById(vehicleId, companyId) {
    try {
      const vehicle = await Vehicle.findOne({
        where: { 
          id: vehicleId,
          company_id: companyId
        },
        include: [
          {
            model: Driver,
            as: 'vehicleDriver',
            attributes: ['id', 'name', 'phone', 'license_number', 'status']
          },
          {
            model: Branch,
            as: 'vehicleBranch',
            attributes: ['id', 'name', 'code', 'town']
          }
        ]
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
      }

      return vehicle;
    } catch (error) {
      logger.error(`Error in getVehicleById: ${error.message}`);
      throw error;
    }
  }

  // Create new vehicle
  async createVehicle(companyId, data, createdBy) {
    const transaction = await sequelize.transaction();

    try {
      const { 
        plate_number, type, route, capacity, capacity_unit,
        branch_id, driver_id, driver_name 
      } = data;

      // Check if plate number already exists
      const existingVehicle = await Vehicle.findOne({
        where: { 
          plate_number: plate_number.toUpperCase()
        }
      });

      if (existingVehicle) {
        throw new AppError('Vehicle with this plate number already exists', HTTP_STATUS.CONFLICT);
      }

      // Create vehicle
      const vehicle = await Vehicle.create({
        company_id: companyId,
        plate_number: plate_number.toUpperCase(),
        type,
        route,
        capacity,
        capacity_unit: capacity_unit || 'units',
        branch_id,
        driver_id,
        driver_name,
        status: 'active',
        is_active: true,
        total_trips: 0,
        total_parcels: 0
      }, { transaction });

      await transaction.commit();

      logger.info(`Vehicle created: ${plate_number} for company ${companyId} by user ${createdBy}`);

      return vehicle;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in createVehicle: ${error.message}`);
      throw error;
    }
  }

  // Update vehicle
  async updateVehicle(vehicleId, companyId, data) {
    try {
      const vehicle = await Vehicle.findOne({
        where: { 
          id: vehicleId,
          company_id: companyId
        }
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
      }

      // If plate number is being updated, check if it's already taken
      if (data.plate_number && data.plate_number.toUpperCase() !== vehicle.plate_number) {
        const existingVehicle = await Vehicle.findOne({
          where: { 
            plate_number: data.plate_number.toUpperCase(),
            id: { [Op.ne]: vehicleId }
          }
        });

        if (existingVehicle) {
          throw new AppError('Vehicle with this plate number already exists', HTTP_STATUS.CONFLICT);
        }
      }

      const allowedUpdates = {};
      if (data.plate_number) allowedUpdates.plate_number = data.plate_number.toUpperCase();
      if (data.type) allowedUpdates.type = data.type;
      if (data.route) allowedUpdates.route = data.route;
      if (data.capacity) allowedUpdates.capacity = data.capacity;
      if (data.capacity_unit) allowedUpdates.capacity_unit = data.capacity_unit;
      if (data.branch_id) allowedUpdates.branch_id = data.branch_id;
      if (data.driver_id) allowedUpdates.driver_id = data.driver_id;
      if (data.driver_name) allowedUpdates.driver_name = data.driver_name;

      await vehicle.update(allowedUpdates);

      logger.info(`Vehicle updated: ${vehicle.plate_number}`);

      return vehicle;
    } catch (error) {
      logger.error(`Error in updateVehicle: ${error.message}`);
      throw error;
    }
  }

  // Update vehicle status
  async updateVehicleStatus(vehicleId, companyId, statusData) {
    try {
      const { status, notes } = statusData;

      const vehicle = await Vehicle.findOne({
        where: { 
          id: vehicleId,
          company_id: companyId
        }
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
      }

      const updateData = { status };
      
      // Handle special status changes
      if (status === 'maintenance') {
        updateData.last_maintenance = new Date();
        updateData.maintenance_notes = notes;
        
        // Set next maintenance date (e.g., 3 months from now)
        const nextMaintenance = new Date();
        nextMaintenance.setMonth(nextMaintenance.getMonth() + 3);
        updateData.next_maintenance = nextMaintenance;
      }
      
      if (status === 'sold') {
        updateData.sold_date = new Date();
        updateData.sold_notes = notes;
        updateData.is_active = false;
      }

      if (status === 'inactive') {
        updateData.is_active = false;
      }

      if (status === 'active') {
        updateData.is_active = true;
      }

      await vehicle.update(updateData);

      logger.info(`Vehicle ${vehicle.plate_number} status updated to ${status}`);

      return vehicle;
    } catch (error) {
      logger.error(`Error in updateVehicleStatus: ${error.message}`);
      throw error;
    }
  }

  // Delete vehicle (soft delete - mark as sold/inactive)
  async deleteVehicle(vehicleId, companyId, notes) {
    try {
      const vehicle = await Vehicle.findOne({
        where: { 
          id: vehicleId,
          company_id: companyId
        }
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
      }

      // Check if vehicle is in transit
      if (vehicle.status === 'in_transit') {
        throw new AppError('Cannot delete vehicle that is currently in transit', HTTP_STATUS.BAD_REQUEST);
      }

      // Soft delete - mark as sold
      await vehicle.update({
        status: 'sold',
        is_active: false,
        sold_date: new Date(),
        sold_notes: notes || 'Vehicle removed from fleet'
      });

      logger.info(`Vehicle ${vehicle.plate_number} marked as sold/removed from fleet`);

      return { success: true };
    } catch (error) {
      logger.error(`Error in deleteVehicle: ${error.message}`);
      throw error;
    }
  }

  // Get vehicle statistics
 // Get vehicle statistics
async getVehicleStats(companyId) {
  try {
    const stats = await Vehicle.findAll({
      where: { company_id: companyId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
        ), 'active'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN status = 'in_transit' THEN 1 END")  // Make sure this matches enum
        ), 'in_transit'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN status = 'maintenance' THEN 1 END")
        ), 'maintenance'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN status = 'inactive' THEN 1 END")
        ), 'inactive'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN status = 'sold' THEN 1 END")
        ), 'sold'],
        [sequelize.fn('SUM', sequelize.col('total_trips')), 'total_trips'],
        [sequelize.fn('SUM', sequelize.col('total_parcels')), 'total_parcels']
      ],
      raw: true
    });

    return stats[0] || {
      total: 0,
      active: 0,
      in_transit: 0,
      maintenance: 0,
      inactive: 0,
      sold: 0,
      total_trips: 0,
      total_parcels: 0
    };
  } catch (error) {
    logger.error(`Error in getVehicleStats: ${error.message}`);
    throw error;
  }
}

  // Assign driver to vehicle
  async assignDriver(vehicleId, companyId, driverId, driverName) {
    try {
      const vehicle = await Vehicle.findOne({
        where: { 
          id: vehicleId,
          company_id: companyId
        }
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
      }

      await vehicle.update({
        driver_id: driverId,
        driver_name: driverName
      });

      logger.info(`Driver assigned to vehicle ${vehicle.plate_number}`);

      return vehicle;
    } catch (error) {
      logger.error(`Error in assignDriver: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CompanyVehicleService();