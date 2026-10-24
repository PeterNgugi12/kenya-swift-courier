const { Trip, Vehicle, Driver, Branch, Parcel, sequelize } = require('../models');
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS } = require('../config/constants');
const NodeCache = require('node-cache');

// Initialize cache
const tripCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

class BranchTripService {
  // Generate trip number
  generateTripNumber(branchCode, destinationCode) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    
    return `TRP-${branchCode}${destinationCode}-${year}${month}${day}-${random}`;
  }

  // OPTIMIZED: Get all trips for a branch
// In src/services/branchTrip.service.js

// OPTIMIZED: Get all trips for a branch
// Simplified version without the parcels_count subquery
async getAllTrips(branchId, companyId, filters = {}, pagination = {}) {
  try {
    const { page = 1, limit = 10 } = pagination;
    const { status, search } = filters;

    // Base where clause
    const where = { 
      origin_branch_id: branchId,
      company_id: companyId 
    };
    
    if (status && status !== 'all') {
      where.status = status;
    }

    // Build includes
    const include = [
      {
        model: Branch,
        as: 'destinationBranch',
        attributes: ['id', 'name', 'code', 'town'],
        required: false
      },
      {
        model: Vehicle,
        as: 'tripVehicle',
        attributes: ['id', 'plate_number', 'type'],
        required: false
      },
      {
        model: Driver,
        as: 'tripDriver',
        attributes: ['id', 'name', 'phone'],
        required: false
      }
    ];

    // Handle search
    if (search) {
      where[Op.or] = [
        { trip_number: { [Op.iLike]: `%${search}%` } }
      ];
      
      // We won't add search to includes for now to simplify
    }

    // Get trips
    const { count, rows } = await Trip.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['departure_time', 'DESC']],
      distinct: true
    });

    // Get origin branch name
    const originBranch = await Branch.findByPk(branchId, {
      attributes: ['name']
    });

    // For each trip, get parcel count separately
    const tripsWithCounts = await Promise.all(
      rows.map(async (trip) => {
        const parcelCount = await Parcel.count({
          where: { trip_id: trip.id }
        });
        
        const tripJson = trip.toJSON();
        return {
          id: tripJson.id,
          trip_number: tripJson.trip_number,
          origin_branch_id: tripJson.origin_branch_id,
          origin_branch_name: originBranch?.name || 'Unknown Branch',
          destination_branch_id: tripJson.destination_branch_id,
          destination_branch_name: tripJson.destinationBranch?.name,
          destination_branch_town: tripJson.destinationBranch?.town,
          vehicle_id: tripJson.vehicle_id,
          vehicle_plate: tripJson.tripVehicle?.plate_number,
          vehicle_type: tripJson.tripVehicle?.type,
          driver_id: tripJson.driver_id,
          driver_name: tripJson.tripDriver?.name,
          driver_phone: tripJson.tripDriver?.phone,
          departure_time: tripJson.departure_time,
          arrival_time: tripJson.arrival_time,
          status: tripJson.status,
          parcels_count: parcelCount,
          created_at: tripJson.created_at
        };
      })
    );

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      data: tripsWithCounts
    };
  } catch (error) {
    logger.error(`Error in getAllTrips: ${error.message}`);
    throw error;
  }
}
  // OPTIMIZED: Get trip by ID
  async getTripById(tripId, branchId) {
    try {
      const cacheKey = `trip:${tripId}`;
      
      const cached = tripCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const trip = await Trip.findOne({
        where: { 
          id: tripId,
          origin_branch_id: branchId
        },
        attributes: {
          include: [
            [
              sequelize.literal(`(
                SELECT COUNT(*) 
                FROM parcels 
                WHERE parcels.trip_id = Trip.id
              )`),
              'parcels_count'
            ],
            [
              sequelize.literal(`(
                SELECT COALESCE(SUM(amount), 0)
                FROM parcels 
                WHERE parcels.trip_id = Trip.id
              )`),
              'total_value'
            ]
          ]
        },
        include: [
          {
            model: Branch,
            as: 'destinationBranch',
            attributes: ['id', 'name', 'code', 'town']
          },
          {
            model: Vehicle,
            as: 'tripVehicle',
            attributes: ['id', 'plate_number', 'type', 'capacity']
          },
          {
            model: Driver,
            as: 'tripDriver',
            attributes: ['id', 'name', 'phone', 'license_number']
          },
          {
            model: Parcel,
            as: 'parcels',
            limit: 50,
            order: [['created_at', 'DESC']],
            attributes: ['id', 'tracking_number', 'status', 'amount', 'receiver_name', 'created_at']
          }
        ]
      });

      if (!trip) {
        throw new AppError('Trip not found', HTTP_STATUS.NOT_FOUND);
      }

      tripCache.set(cacheKey, trip);
      return trip;
    } catch (error) {
      logger.error(`Error in getTripById: ${error.message}`);
      throw error;
    }
  }

  // OPTIMIZED: Create new trip
  async createTrip(branchId, companyId, userId, data) {
    const transaction = await sequelize.transaction();

    try {
      const {
        destination_branch_id,
        vehicle_id,
        driver_id,
        driver_name,
        driver_phone,
        departure_date,
        departure_time
      } = data;

      // Get all needed data in parallel
      const [originBranch, destBranch, vehicle, driver] = await Promise.all([
        Branch.findByPk(branchId, { attributes: ['id', 'code', 'name'] }),
        Branch.findByPk(destination_branch_id, { attributes: ['id', 'code', 'name'] }),
        Vehicle.findByPk(vehicle_id, { attributes: ['id', 'plate_number', 'type'] }),
        Driver.findByPk(driver_id, { attributes: ['id', 'name', 'phone'] })
      ]);

      if (!originBranch) {
        throw new AppError('Origin branch not found', HTTP_STATUS.NOT_FOUND);
      }
      if (!destBranch) {
        throw new AppError('Destination branch not found', HTTP_STATUS.NOT_FOUND);
      }
      if (!vehicle) {
        throw new AppError('Vehicle not found', HTTP_STATUS.NOT_FOUND);
      }
      if (!driver) {
        throw new AppError('Driver not found', HTTP_STATUS.NOT_FOUND);
      }

      // Generate trip number
      const tripNumber = this.generateTripNumber(
        originBranch.code || 'NBO',
        destBranch.code || 'XXX'
      );

      // Create departure datetime
      const departureDateTime = new Date(`${departure_date}T${departure_time}`);
      if (isNaN(departureDateTime.getTime())) {
        throw new AppError('Invalid departure date or time', HTTP_STATUS.BAD_REQUEST);
      }

      // Create trip
      const trip = await Trip.create({
        company_id: companyId,
        origin_branch_id: branchId,
        destination_branch_id,
        trip_number: tripNumber,
        vehicle_id,
        vehicle_plate: vehicle.plate_number,
        vehicle_type: vehicle.type || 'Unknown',
        driver_id,
        driver_name,
        driver_phone,
        departure_time: departureDateTime,
        status: 'scheduled',
        created_by: userId
      }, { transaction });

      // Update vehicle and driver status in parallel
      await Promise.all([
        Vehicle.update(
          { status: 'assigned' },
          { where: { id: vehicle_id }, transaction }
        ),
        Driver.update(
          { status: 'assigned' },
          { where: { id: driver_id }, transaction }
        )
      ]);

      await transaction.commit();

      // Clear relevant caches
      this.clearTripsCache(branchId);

      logger.info(`Trip created: ${tripNumber} for branch ${branchId}`);

      return {
        id: trip.id,
        trip_number: trip.trip_number,
        origin_branch_name: originBranch.name,
        destination_branch_name: destBranch.name,
        vehicle_plate: vehicle.plate_number,
        vehicle_type: vehicle.type,
        driver_name,
        driver_phone,
        departure_time: trip.departure_time,
        status: trip.status
      };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in createTrip: ${error.message}`);
      throw error;
    }
  }

  // OPTIMIZED: Get incoming trips
  async getIncomingTrips(branchId, companyId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10, status = 'in_transit', date, search } = filters;

      const where = {
        company_id: companyId,
        destination_branch_id: branchId
      };

      // Status filter
      if (status && status !== 'all') {
        where.status = status;
      }

      // Date filter
      if (date === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        where.departure_time = {
          [Op.between]: [today, tomorrow]
        };
      }

      // Single optimized query with subquery for parcel count
      const { count, rows } = await Trip.findAndCountAll({
        where,
        attributes: {
          include: [
            [
              sequelize.literal(`(
                SELECT COUNT(*) 
                FROM parcels 
                WHERE parcels.trip_id = Trip.id 
                AND parcels.destination_branch = '${branchId}'
              )`),
              'branch_parcels_count'
            ],
            [
              sequelize.literal(`(
                SELECT COUNT(*) 
                FROM parcels 
                WHERE parcels.trip_id = Trip.id
              )`),
              'total_parcels_count'
            ]
          ]
        },
        include: [
          {
            model: Branch,
            as: 'originBranch',
            attributes: ['id', 'name', 'code', 'town']
          },
          {
            model: Vehicle,
            as: 'tripVehicle',
            attributes: ['id', 'plate_number', 'type']
          },
          {
            model: Driver,
            as: 'tripDriver',
            attributes: ['id', 'name', 'phone']
          }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['departure_time', 'DESC']],
        subQuery: false
      });

      // Filter and transform in memory (now with pre-calculated counts)
      let trips = rows
        .map(trip => {
          const tripJson = trip.toJSON();
          const branchParcelsCount = parseInt(tripJson.branch_parcels_count) || 0;
          
          return {
            id: tripJson.id,
            trip_number: tripJson.trip_number,
            origin_branch_id: tripJson.origin_branch_id,
            origin_branch_name: tripJson.originBranch?.name || 'Unknown',
            origin_branch_town: tripJson.originBranch?.town,
            vehicle_plate: tripJson.tripVehicle?.plate_number,
            vehicle_type: tripJson.tripVehicle?.type,
            driver_name: tripJson.tripDriver?.name,
            driver_phone: tripJson.tripDriver?.phone,
            departure_time: tripJson.departure_time,
            arrival_time: tripJson.arrival_time,
            parcels_count: branchParcelsCount,
            total_parcels: parseInt(tripJson.total_parcels_count) || 0,
            status: tripJson.status
          };
        })
        .filter(trip => trip.parcels_count > 0); // Only trips with parcels for this branch

      // Apply search filter if needed
      if (search) {
        const searchLower = search.toLowerCase();
        trips = trips.filter(trip => 
          trip.trip_number?.toLowerCase().includes(searchLower) ||
          trip.driver_name?.toLowerCase().includes(searchLower) ||
          trip.vehicle_plate?.toLowerCase().includes(searchLower) ||
          trip.origin_branch_name?.toLowerCase().includes(searchLower)
        );
      }

      // Recalculate total after filtering
      const filteredTotal = trips.length;
      
      // Apply pagination to filtered results
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedTrips = trips.slice(startIndex, startIndex + parseInt(limit));

      return {
        total: filteredTotal,
        page: parseInt(page),
        limit: parseInt(limit),
        data: paginatedTrips
      };
    } catch (error) {
      logger.error(`Error in getIncomingTrips: ${error.message}`);
      throw error;
    }
  }

  // OPTIMIZED: Get trip statistics
  async getTripStats(branchId, companyId) {
    try {
      const cacheKey = `tripstats:${branchId}`;
      
      const cached = tripCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Single query for all stats
      const stats = await sequelize.query(`
        WITH trip_stats AS (
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit,
            COUNT(CASE WHEN status = 'arrived' THEN 1 END) as arrived,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
            COUNT(CASE WHEN departure_time >= :startOfDay THEN 1 END) as trips_today
          FROM trips
          WHERE origin_branch_id = :branchId AND company_id = :companyId
        ),
        parcel_stats AS (
          SELECT COALESCE(SUM(parcel_count), 0) as total_parcels
          FROM (
            SELECT COUNT(*) as parcel_count
            FROM parcels p
            JOIN trips t ON t.id = p.trip_id
            WHERE t.origin_branch_id = :branchId AND t.company_id = :companyId
            GROUP BY t.id
          ) counts
        )
        SELECT * FROM trip_stats, parcel_stats;
      `, {
        replacements: { branchId, companyId, startOfDay: startOfDay.toISOString() },
        type: sequelize.QueryTypes.SELECT
      });

      const result = stats[0] || {};
      
      const formattedStats = {
        total: parseInt(result.total) || 0,
        in_transit: parseInt(result.in_transit) || 0,
        arrived: parseInt(result.arrived) || 0,
        scheduled: parseInt(result.scheduled) || 0,
        trips_today: parseInt(result.trips_today) || 0,
        total_parcels: parseInt(result.total_parcels) || 0
      };

      // Cache for 2 minutes
      tripCache.set(cacheKey, formattedStats, 120);

      return formattedStats;
    } catch (error) {
      logger.error(`Error in getTripStats: ${error.message}`);
      return {
        total: 0,
        in_transit: 0,
        arrived: 0,
        scheduled: 0,
        trips_today: 0,
        total_parcels: 0
      };
    }
  }

  // Get available vehicles
  async getAvailableVehicles(companyId) {
    try {
      const cacheKey = `available:vehicles:${companyId}`;
      
      const cached = tripCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const vehicles = await Vehicle.findAll({
        where: {
          company_id: companyId,
          status: 'active',
          is_active: true
        },
        attributes: ['id', 'plate_number', 'type', 'capacity'],
        order: [['plate_number', 'ASC']],
        limit: 50
      });

      tripCache.set(cacheKey, vehicles, 60); // Cache for 1 minute
      return vehicles;
    } catch (error) {
      logger.error(`Error in getAvailableVehicles: ${error.message}`);
      return [];
    }
  }

  // Get available drivers
  async getAvailableDrivers(companyId) {
    try {
      const cacheKey = `available:drivers:${companyId}`;
      
      const cached = tripCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const drivers = await Driver.findAll({
        where: {
          company_id: companyId,
          status: 'active',
          is_active: true
        },
        attributes: ['id', 'name', 'phone', 'license_number'],
        order: [['name', 'ASC']],
        limit: 50
      });

      tripCache.set(cacheKey, drivers, 60); // Cache for 1 minute
      return drivers;
    } catch (error) {
      logger.error(`Error in getAvailableDrivers: ${error.message}`);
      return [];
    }
  }

  // Get destination branches
  async getDestinationBranches(companyId, currentBranchId) {
    try {
      const cacheKey = `destinations:${companyId}:${currentBranchId}`;
      
      const cached = tripCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const branches = await Branch.findAll({
        where: {
          company_id: companyId,
          is_active: true,
          id: { [Op.ne]: currentBranchId }
        },
        attributes: ['id', 'name', 'code', 'town'],
        order: [['name', 'ASC']]
      });

      tripCache.set(cacheKey, branches, 300); // Cache for 5 minutes
      return branches;
    } catch (error) {
      logger.error(`Error in getDestinationBranches: ${error.message}`);
      return [];
    }
  }

  // Update trip status
  async updateTripStatus(tripId, branchId, status) {
    try {
      const trip = await Trip.findOne({
        where: { 
          id: tripId,
          origin_branch_id: branchId
        }
      });

      if (!trip) {
        throw new AppError('Trip not found', HTTP_STATUS.NOT_FOUND);
      }

      const updateData = { status };
      
      if (status === 'arrived') {
        updateData.arrival_time = new Date();
      }

      await trip.update(updateData);

      // Clear caches
      this.clearTripsCache(branchId);
      tripCache.del(`trip:${tripId}`);

      logger.info(`Trip ${trip.trip_number} status updated to ${status}`);

      return trip;
    } catch (error) {
      logger.error(`Error in updateTripStatus: ${error.message}`);
      throw error;
    }
  }

  // Confirm trip arrival
  async confirmTripArrival(tripId, branchId) {
    const transaction = await sequelize.transaction();

    try {
      // Find trip with all needed data
      const trip = await Trip.findOne({
        where: { 
          id: tripId,
          destination_branch_id: branchId
        },
        include: [
          {
            model: Vehicle,
            as: 'tripVehicle',
            attributes: ['id']
          },
          {
            model: Driver,
            as: 'tripDriver',
            attributes: ['id']
          }
        ],
        transaction
      });

      if (!trip) {
        throw new AppError('Trip not found', HTTP_STATUS.NOT_FOUND);
      }

      // Update trip status
      await trip.update({
        status: 'arrived',
        arrival_time: new Date()
      }, { transaction });

      // Update vehicle status
      if (trip.vehicle_id) {
        await Vehicle.update(
          { status: 'active' },
          { where: { id: trip.vehicle_id }, transaction }
        );
      }

      // Update driver status
      if (trip.driver_id) {
        await Driver.update(
          { status: 'active' },
          { where: { id: trip.driver_id }, transaction }
        );
      }

      // Update all parcels in this trip
      const [updatedCount] = await Parcel.update(
        { 
          status: 'arrived',
          updated_at: new Date()
        },
        {
          where: { 
            trip_id: tripId,
            destination_branch: branchId
          },
          transaction
        }
      );

      await transaction.commit();

      // Clear caches
      this.clearTripsCache(branchId);
      tripCache.del(`trip:${tripId}`);

      return {
        trip_id: tripId,
        parcels_updated: updatedCount
      };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in confirmTripArrival: ${error.message}`);
      throw error;
    }
  }

  // Cache management
  clearTripsCache(branchId) {
    const keys = tripCache.keys();
    const patterns = [
      `trips:${branchId}`,
      `tripstats:${branchId}`,
      `incoming:${branchId}`
    ];
    
    keys.forEach(key => {
      if (patterns.some(pattern => key.startsWith(pattern))) {
        tripCache.del(key);
      }
    });
  }
}

module.exports = new BranchTripService();