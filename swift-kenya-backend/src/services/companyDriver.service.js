const { Driver, Vehicle, Branch } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS } = require('../config/constants');

class CompanyDriverService {
  // Get all drivers for a company
  async getAllDrivers(companyId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const { status, search, branch_id } = filters;

      const where = { company_id: companyId };
      
      if (status && status !== 'all') where.status = status;
      if (branch_id) where.branch_id = branch_id;
      
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
          { license_number: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows } = await Driver.findAndCountAll({
        where,
        include: [
          {
            model: Vehicle,
            as: 'driverVehicles',  // ✅ CORRECT - plural
            attributes: ['id', 'plate_number', 'type', 'capacity'],
            required: false
          },
          {
            model: Branch,
            as: 'driverBranch',
            attributes: ['id', 'name', 'code', 'town'],
            required: false
          }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']]
      });

      // Transform data for frontend
      const drivers = rows.map(d => {
        const driver = d.toJSON();
        const assignedVehicle = driver.driverVehicles && driver.driverVehicles.length > 0 
          ? driver.driverVehicles[0] 
          : null;
          
        return {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          vehicle: assignedVehicle?.plate_number || 'Unassigned',
          vehicle_id: assignedVehicle?.id,
          route: driver.route || '—',
          trips: driver.total_trips || 0,
          status: driver.status,
          rating: parseFloat(driver.rating) || 4.0,
          license: driver.license_number,
          branch: driver.driverBranch,
          hire_date: driver.hire_date,
          leave_start: driver.leave_start,
          leave_end: driver.leave_end,
          leave_reason: driver.leave_reason
        };
      });

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: drivers
      };
    } catch (error) {
      logger.error(`Error in getAllDrivers: ${error.message}`);
      throw error;
    }
  }

  // Get driver by ID
  async getDriverById(driverId, companyId) {
    try {
      const driver = await Driver.findOne({
        where: { 
          id: driverId,
          company_id: companyId
        },
        include: [
          {
            model: Vehicle,
            as: 'driverVehicles',  // ✅ CORRECT - plural
            attributes: ['id', 'plate_number', 'type', 'capacity', 'status']
          },
          {
            model: Branch,
            as: 'driverBranch',
            attributes: ['id', 'name', 'code', 'town']
          }
        ]
      });

      if (!driver) {
        throw new AppError('Driver not found', HTTP_STATUS.NOT_FOUND);
      }

      return driver;
    } catch (error) {
      logger.error(`Error in getDriverById: ${error.message}`);
      throw error;
    }
  }

  // Create new driver
  async createDriver(companyId, data, createdBy) {
    const transaction = await sequelize.transaction();

    try {
      const { 
        name, phone, email, license_number, license_expiry,
        vehicle_id, route, branch_id, notes
      } = data;

      // Check if license number already exists
      const existingDriver = await Driver.findOne({
        where: { 
          license_number: license_number.toUpperCase()
        }
      });

      if (existingDriver) {
        throw new AppError('Driver with this license number already exists', HTTP_STATUS.CONFLICT);
      }

      // If vehicle is assigned, check if it's available
      let vehiclePlate = null;
      if (vehicle_id) {
        const vehicle = await Vehicle.findOne({
          where: { 
            id: vehicle_id,
            company_id: companyId
          }
        });

        if (!vehicle) {
          throw new AppError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
        }

        vehiclePlate = vehicle.plate_number;

        // Check if vehicle already has a driver
        const existingDriverWithVehicle = await Driver.findOne({
          where: { 
            vehicle_id: vehicle_id,
            status: { [Op.in]: ['active', 'on_trip'] }
          }
        });

        if (existingDriverWithVehicle) {
          throw new AppError('Vehicle already assigned to another driver', HTTP_STATUS.CONFLICT);
        }
      }

      // Create driver
      const driver = await Driver.create({
        company_id: companyId,
        name,
        phone,
        email,
        license_number: license_number.toUpperCase(),
        license_expiry,
        vehicle_id: vehicle_id || null,
        vehicle_plate: vehiclePlate,
        route,
        branch_id,
        status: 'active',
        is_active: true,
        total_trips: 0,
        rating: 4.0,
        hire_date: new Date(),
        notes
      }, { transaction });

      // If vehicle assigned, update vehicle's driver info
      if (vehicle_id) {
        await Vehicle.update({
          driver_id: driver.id,
          driver_name: driver.name
        }, {
          where: { id: vehicle_id },
          transaction
        });
      }

      await transaction.commit();

      logger.info(`Driver created: ${name} for company ${companyId} by user ${createdBy}`);

      return driver;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in createDriver: ${error.message}`);
      throw error;
    }
  }

  // Update driver
  async updateDriver(driverId, companyId, data) {
    const transaction = await sequelize.transaction();

    try {
      const driver = await Driver.findOne({
        where: { 
          id: driverId,
          company_id: companyId
        }
      });

      if (!driver) {
        throw new AppError('Driver not found', HTTP_STATUS.NOT_FOUND);
      }

      // If license number is being updated, check if it's already taken
      if (data.license_number && data.license_number.toUpperCase() !== driver.license_number) {
        const existingDriver = await Driver.findOne({
          where: { 
            license_number: data.license_number.toUpperCase(),
            id: { [Op.ne]: driverId }
          }
        });

        if (existingDriver) {
          throw new AppError('Driver with this license number already exists', HTTP_STATUS.CONFLICT);
        }
      }

      // If vehicle is being changed
      if (data.vehicle_id && data.vehicle_id !== driver.vehicle_id) {
        // Check if new vehicle is available
        const existingDriverWithVehicle = await Driver.findOne({
          where: { 
            vehicle_id: data.vehicle_id,
            status: { [Op.in]: ['active', 'on_trip'] },
            id: { [Op.ne]: driverId }
          }
        });

        if (existingDriverWithVehicle) {
          throw new AppError('Vehicle already assigned to another driver', HTTP_STATUS.CONFLICT);
        }

        // Get new vehicle details
        const newVehicle = await Vehicle.findOne({
          where: { id: data.vehicle_id, company_id: companyId }
        });

        // Update old vehicle's driver info
        if (driver.vehicle_id) {
          await Vehicle.update({
            driver_id: null,
            driver_name: null
          }, {
            where: { id: driver.vehicle_id },
            transaction
          });
        }

        // Update new vehicle's driver info
        await Vehicle.update({
          driver_id: driver.id,
          driver_name: data.name || driver.name
        }, {
          where: { id: data.vehicle_id },
          transaction
        });

        data.vehicle_plate = newVehicle?.plate_number;
      }

      const allowedUpdates = {};
      if (data.name) allowedUpdates.name = data.name;
      if (data.phone) allowedUpdates.phone = data.phone;
      if (data.email) allowedUpdates.email = data.email;
      if (data.license_number) allowedUpdates.license_number = data.license_number.toUpperCase();
      if (data.license_expiry) allowedUpdates.license_expiry = data.license_expiry;
      if (data.vehicle_id !== undefined) allowedUpdates.vehicle_id = data.vehicle_id;
      if (data.vehicle_plate) allowedUpdates.vehicle_plate = data.vehicle_plate;
      if (data.route) allowedUpdates.route = data.route;
      if (data.branch_id) allowedUpdates.branch_id = data.branch_id;
      if (data.rating) allowedUpdates.rating = data.rating;
      if (data.notes) allowedUpdates.notes = data.notes;

      await driver.update(allowedUpdates, { transaction });

      await transaction.commit();

      logger.info(`Driver updated: ${driver.name}`);

      return driver;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in updateDriver: ${error.message}`);
      throw error;
    }
  }

  // Update driver status (including leave)
  async updateDriverStatus(driverId, companyId, statusData) {
    try {
      const { status, leave_reason, leave_end } = statusData;

      const driver = await Driver.findOne({
        where: { 
          id: driverId,
          company_id: companyId
        }
      });

      if (!driver) {
        throw new AppError('Driver not found', HTTP_STATUS.NOT_FOUND);
      }

      const updateData = { status };
      
      // Handle leave status
      if (status === 'on_leave') {
        updateData.leave_start = new Date();
        updateData.leave_reason = leave_reason || 'Not specified';
        if (leave_end) updateData.leave_end = leave_end;
      }

      if (status === 'active' && driver.status === 'on_leave') {
        updateData.leave_start = null;
        updateData.leave_end = null;
        updateData.leave_reason = null;
      }

      if (status === 'inactive') {
        updateData.is_active = false;
      }

      if (status === 'active') {
        updateData.is_active = true;
      }

      await driver.update(updateData);

      logger.info(`Driver ${driver.name} status updated to ${status}`);

      return driver;
    } catch (error) {
      logger.error(`Error in updateDriverStatus: ${error.message}`);
      throw error;
    }
  }

  // Delete driver (soft delete)
  async deleteDriver(driverId, companyId) {
    const transaction = await sequelize.transaction();

    try {
      const driver = await Driver.findOne({
        where: { 
          id: driverId,
          company_id: companyId
        }
      });

      if (!driver) {
        throw new AppError('Driver not found', HTTP_STATUS.NOT_FOUND);
      }

      // Check if driver is on trip
      if (driver.status === 'on_trip') {
        throw new AppError('Cannot delete driver who is currently on a trip', HTTP_STATUS.BAD_REQUEST);
      }

      // Unassign from vehicle if assigned
      if (driver.vehicle_id) {
        await Vehicle.update({
          driver_id: null,
          driver_name: null
        }, {
          where: { id: driver.vehicle_id },
          transaction
        });
      }

      // Soft delete
      await driver.update({
        status: 'inactive',
        is_active: false,
        vehicle_id: null,
        vehicle_plate: null
      }, { transaction });

      await transaction.commit();

      logger.info(`Driver ${driver.name} deactivated`);

      return { success: true };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in deleteDriver: ${error.message}`);
      throw error;
    }
  }

  // Get driver statistics
  async getDriverStats(companyId) {
    try {
      const stats = await Driver.findAll({
        where: { company_id: companyId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
          ), 'active'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'on_trip' THEN 1 END")
          ), 'on_trip'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'on_leave' THEN 1 END")
          ), 'on_leave'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'inactive' THEN 1 END")
          ), 'inactive'],
          [sequelize.fn('SUM', sequelize.col('total_trips')), 'total_trips'],
          [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating']
        ],
        raw: true
      });

      return stats[0] || {
        total: 0,
        active: 0,
        on_trip: 0,
        on_leave: 0,
        inactive: 0,
        total_trips: 0,
        avg_rating: 0
      };
    } catch (error) {
      logger.error(`Error in getDriverStats: ${error.message}`);
      throw error;
    }
  }

  // Get available vehicles for assignment
  // Get available vehicles for assignment
async getAvailableVehicles(companyId) {
  try {
    const vehicles = await Vehicle.findAll({
      where: {
        company_id: companyId,
        status: 'active',
        is_active: true
      },
      include: [{
        model: Driver,
        as: 'vehicleDriver',  // ✅ CORRECT - this is the Vehicle->Driver alias
        required: false
      }],
      // Filter to only get vehicles with no driver assigned
      where: {
        company_id: companyId,
        status: 'active',
        is_active: true,
        driver_id: null  // Directly check if driver_id is null
      },
      attributes: ['id', 'plate_number', 'type', 'capacity']
    });

    return vehicles.map(v => ({
      id: v.id,
      plate: v.plate_number,
      type: v.type,
      capacity: v.capacity
    }));
  } catch (error) {
    logger.error(`Error in getAvailableVehicles: ${error.message}`);
    throw error;
  }
}
}

module.exports = new CompanyDriverService();