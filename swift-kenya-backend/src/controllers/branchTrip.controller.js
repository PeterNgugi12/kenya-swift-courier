// In src/controllers/branchTrip.controller.js

const { Trip, Parcel, Branch, Vehicle, Driver, SMSLog, sequelize } = require('../models');
const { Op } = require('sequelize'); 
const branchTripService = require('../services/branchTrip.service');
const smsService = require('../services/sms.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');
const { body, validationResult } = require('express-validator');
const AppError = require('../utils/appError.util');

class BranchTripController {
  // Validation rules
  validateCreate = [
    body('destination_branch_id').notEmpty().withMessage('Destination branch is required'),
    body('vehicle_id').notEmpty().withMessage('Vehicle is required'),
    body('driver_id').notEmpty().withMessage('Driver is required'),
    body('driver_name').notEmpty().withMessage('Driver name is required'),
    body('driver_phone').notEmpty().withMessage('Driver phone is required'),
    body('departure_date').notEmpty().withMessage('Departure date is required'),
    body('departure_time').notEmpty().withMessage('Departure time is required')
  ];

  // Get all trips
  getAllTrips = catchAsync(async (req, res) => {
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    const { page = 1, limit = 10, status, search } = req.query;
    
    logger.info(`Fetching trips for branch: ${branchId}`);
    
    // REMOVE ANY REFERENCE TO tripCache HERE
    // The cache is handled inside the service
    
    const result = await branchTripService.getAllTrips(
      branchId,
      companyId,
      { status, search },
      { page, limit }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  });

  // Get trip by ID
  getTripById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const branchId = req.user.branch_id;
    
    const trip = await branchTripService.getTripById(id, branchId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: trip
    });
  });

  // Create new trip
  createTrip = catchAsync(async (req, res) => {
    console.log("=".repeat(50));
    console.log("🔍 CREATE TRIP REQUEST RECEIVED");
    console.log("=".repeat(50));
    console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
    console.log("👤 User:", {
      id: req.user?.id,
      email: req.user?.email,
      branch_id: req.user?.branch_id,
      company_id: req.user?.company_id,
      role: req.user?.role
    });
    
    // Check validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Validation errors:", errors.array());
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const branchId = req.user.branch_id;
      const companyId = req.user.company_id;
      const userId = req.user.id;
      
      console.log("🔄 Calling service with:", { branchId, companyId, userId });
      
      const trip = await branchTripService.createTrip(branchId, companyId, userId, req.body);
      
      console.log("✅ Service returned:", JSON.stringify(trip, null, 2));
      
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Trip created successfully',
        data: trip
      });
    } catch (error) {
      console.error("❌ Error in createTrip controller:", error);
      console.error("Error stack:", error.stack);
      
      if (error instanceof AppError) {
        return res.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to create trip'
      });
    }
  });

  // Update trip status
  updateTripStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const branchId = req.user.branch_id;
    
    const trip = await branchTripService.updateTripStatus(id, branchId, status);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Trip status updated to ${status}`,
      data: trip
    });
  });

  // Get available vehicles
  getAvailableVehicles = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const vehicles = await branchTripService.getAvailableVehicles(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: vehicles
    });
  });

  // Get available drivers
  getAvailableDrivers = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const drivers = await branchTripService.getAvailableDrivers(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: drivers
    });
  });

  // Get destination branches
  getDestinationBranches = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    const currentBranchId = req.user.branch_id;
    
    const branches = await branchTripService.getDestinationBranches(companyId, currentBranchId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: branches
    });
  });

  // Get trip statistics
  getTripStats = catchAsync(async (req, res) => {
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    
    const stats = await branchTripService.getTripStats(branchId, companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats
    });
  });

  // Get incoming trips (trips destined for this branch)
  getIncomingTrips = catchAsync(async (req, res) => {
    try {
      const branchId = req.user.branch_id;
      const companyId = req.user.company_id;
      const { page = 1, limit = 10, status, search, date, confirmed } = req.query;
      
      console.log("📋 Fetching incoming trips for branch:", branchId);
      console.log("Query params:", { page, limit, status, search, date, confirmed });
      
      const where = {
        company_id: companyId,
        destination_branch_id: branchId,
        status: status || 'in_transit' // Default to only in_transit (unconfirmed)
      };
      
      // Filter for today's trips
      if (date === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        where.departure_time = {
          [Op.between]: [today, tomorrow]
        };
      }
      
      // Build include options
      const includeOptions = [
        {
          model: Branch,
          as: 'originBranch',
          attributes: ['name', 'code', 'town']
        }
      ];

      // Get trips
      let trips = await Trip.findAll({
        where,
        include: includeOptions,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['departure_time', 'DESC']]
      });

      // Get parcel counts for each trip - ONLY COUNT PARCELS DESTINED FOR THIS BRANCH
      const tripsWithParcels = await Promise.all(
        trips.map(async (trip) => {
          const parcelCount = await Parcel.count({
            where: { 
              trip_id: trip.id,
              destination_branch: branchId
            }
          });
          
          return {
            id: trip.id,
            trip_number: trip.trip_number,
            origin_branch_id: trip.origin_branch_id,
            origin_branch_name: trip.originBranch?.name || 'Unknown',
            destination_branch_id: trip.destination_branch_id,
            destination_branch_name: 'This Branch',
            vehicle_id: trip.vehicle_id,
            vehicle_plate: trip.vehicle_plate,
            vehicle_type: trip.vehicle_type,
            driver_id: trip.driver_id,
            driver_name: trip.driver_name,
            driver_phone: trip.driver_phone,
            departure_time: trip.departure_time,
            arrival_time: trip.arrival_time,
            parcels_count: parcelCount,
            status: trip.status
          };
        })
      );
      
      // Filter out trips that have no parcels for this branch
      let filteredTrips = tripsWithParcels.filter(trip => trip.parcels_count > 0);
      
      // Apply search filter if needed
      if (search) {
        const searchLower = search.toLowerCase();
        filteredTrips = filteredTrips.filter(trip => 
          trip.trip_number?.toLowerCase().includes(searchLower) ||
          trip.driver_name?.toLowerCase().includes(searchLower) ||
          trip.vehicle_plate?.toLowerCase().includes(searchLower) ||
          trip.origin_branch_name?.toLowerCase().includes(searchLower)
        );
      }
      
      console.log(`✅ Found ${filteredTrips.length} incoming trips`);
      
      // Apply pagination to filtered results
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedTrips = filteredTrips.slice(startIndex, startIndex + parseInt(limit));
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          total: filteredTrips.length,
          page: parseInt(page),
          limit: parseInt(limit),
          data: paginatedTrips
        }
      });
    } catch (error) {
      console.error("❌ Error in getIncomingTrips:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // Get trip history
  getTripHistory = catchAsync(async (req, res) => {
    try {
      const branchId = req.user.branch_id;
      const companyId = req.user.company_id;
      const {
        page = 1,
        limit = 10,
        start_date,
        end_date,
        search,
        payment_status,
        sms_status,
        sort = 'arrival_time',
        order = 'DESC'
      } = req.query;
      
      console.log("📋 Fetching trip history for branch:", branchId);
      console.log("Filters:", {
        start_date,
        end_date,
        search,
        payment_status,
        sms_status
      });

      // Parse dates
      const startDate = start_date ? new Date(start_date) : null;
      let endDate = end_date ? new Date(end_date) : null;
      
      // Validate dates
      if (startDate && isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid start date format'
        });
      }
      if (endDate && isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end date format'
        });
      }

      // If end date is provided, set it to the end of the day
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }

      // Build where clause for trips
      const tripWhere = {
        company_id: companyId,
        destination_branch_id: branchId,
        status: 'arrived'
      };

      // Date range filter
      if (startDate && endDate) {
        tripWhere.arrival_time = {
          [Op.between]: [startDate, endDate]
        };
      } else if (startDate) {
        tripWhere.arrival_time = {
          [Op.gte]: startDate
        };
      } else if (endDate) {
        tripWhere.arrival_time = {
          [Op.lte]: endDate
        };
      }

      // Get total count of trips matching criteria
      const total = await Trip.count({
        where: tripWhere,
        include: search ? [
          {
            model: Branch,
            as: 'originBranch',
            required: false,
            attributes: []
          }
        ] : []
      });

      // Build the main query with proper includes
      const includeOptions = [
        {
          model: Branch,
          as: 'originBranch',
          attributes: ['id', 'name', 'code', 'town']
        }
      ];

      // Build parcel where clause for filtering
      const parcelWhere = {};
      if (payment_status && payment_status !== 'all') {
        parcelWhere.payment_status = payment_status;
      }
      if (sms_status && sms_status !== 'all') {
        parcelWhere.sms_sent = sms_status === 'sent';
      }

      // Add parcels include with filters
      includeOptions.push({
        model: Parcel,
        as: 'parcels',
        required: false,
        where: Object.keys(parcelWhere).length > 0 ? parcelWhere : undefined,
        include: [
          {
            model: Branch,
            as: 'originBranch',
            attributes: ['name', 'town']
          }
        ]
      });

      // Get trips with pagination
      let trips = await Trip.findAll({
        where: tripWhere,
        include: includeOptions,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [[sort, order]]
      });

      // Apply search filter after the query if needed (since it's on related model)
      if (search) {
        const searchLower = search.toLowerCase();
        trips = trips.filter(trip => {
          const tripData = trip.toJSON();
          // Search in trip fields
          if (tripData.trip_number?.toLowerCase().includes(searchLower)) return true;
          if (tripData.driver_name?.toLowerCase().includes(searchLower)) return true;
          if (tripData.vehicle_plate?.toLowerCase().includes(searchLower)) return true;
          if (tripData.originBranch?.name?.toLowerCase().includes(searchLower)) return true;
          
          // Search in parcels
          if (tripData.parcels) {
            return tripData.parcels.some(parcel => 
              parcel.tracking_number?.toLowerCase().includes(searchLower) ||
              parcel.receiver_name?.toLowerCase().includes(searchLower) ||
              parcel.sender_name?.toLowerCase().includes(searchLower)
            );
          }
          return false;
        });
      }

      // Transform the data
      const transformedTrips = trips.map(trip => {
        const tripData = trip.toJSON();
        
        // Calculate parcel stats
        const parcels = tripData.parcels || [];
        const totalParcels = parcels.length;
        const smsSentCount = parcels.filter(p => p.sms_sent).length;
        
        return {
          id: tripData.id,
          trip_number: tripData.trip_number,
          origin_branch_id: tripData.origin_branch_id,
          origin_branch_name: tripData.originBranch?.name || 'Unknown',
          destination_branch_id: tripData.destination_branch_id,
          destination_branch_name: 'This Branch',
          vehicle_id: tripData.vehicle_id,
          vehicle_plate: tripData.vehicle_plate,
          vehicle_type: tripData.vehicle_type,
          driver_id: tripData.driver_id,
          driver_name: tripData.driver_name,
          driver_phone: tripData.driver_phone,
          departure_time: tripData.departure_time,
          arrival_time: tripData.arrival_time,
          status: tripData.status,
          parcels_count: totalParcels,
          parcels: parcels,
          stats: {
            sms_sent_count: smsSentCount,
            sms_pending_count: totalParcels - smsSentCount
          }
        };
      });

      // If payment_status or sms_status filters are applied, filter out trips with no matching parcels
      let filteredTrips = transformedTrips;
      if ((payment_status && payment_status !== 'all') || (sms_status && sms_status !== 'all')) {
        filteredTrips = transformedTrips.filter(trip => trip.parcels_count > 0);
      }

      // Update total count after filtering
      const filteredTotal = filteredTrips.length;
      
      // Apply pagination to filtered results
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedTrips = filteredTrips.slice(startIndex, startIndex + parseInt(limit));

      console.log(`✅ Found ${filteredTotal} trips in history`);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          total: filteredTotal,
          page: parseInt(page),
          limit: parseInt(limit),
          data: paginatedTrips
        }
      });

    } catch (error) {
      console.error("❌ Error in getTripHistory:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // Get parcels for a specific trip
  getTripParcels = catchAsync(async (req, res) => {
    try {
      const { tripId } = req.params;
      const branchId = req.user.branch_id;
      const { page = 1, limit = 10 } = req.query;
      
      console.log("📋 Fetching parcels for trip:", tripId);
      
      // Verify trip belongs to this branch
      const trip = await Trip.findOne({
        where: {
          id: tripId,
          destination_branch_id: branchId
        }
      });
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          message: 'Trip not found'
        });
      }
      
      // ✅ Only get parcels destined for this branch
      const { count, rows } = await Parcel.findAndCountAll({
        where: { 
          trip_id: tripId,
          destination_branch: branchId  // Add this filter!
        },
        include: [
          {
            model: Branch,
            as: 'destinationBranch',
            attributes: ['name', 'town']
          }
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['created_at', 'DESC']]
      });
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          data: rows
        }
      });
    } catch (error) {
      console.error("❌ Error in getTripParcels:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // Send SMS notification for pickup
sendPickupNotification = catchAsync(async (req, res) => {
  try {
    const { tracking_number, phone_number, receiver_name } = req.body;
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    
    console.log("📱 SMS notification requested for:", {
      tracking_number,
      phone_number,
      receiver_name,
      branchId
    });
    
    // Check for RECENT SUCCESSFUL SMS only (not failed/duplicate/error)
    const recentSuccess = await SMSLog.findOne({
      where: {
        phone_number,
        message: {
          [Op.like]: `%${tracking_number}%`
        },
        status: 'sent', // Only block if it was actually sent successfully
        created_at: {
          [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    });

    if (recentSuccess) {
      console.log("⚠️ Duplicate successful SMS detected, skipping...");
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'SMS already sent successfully recently',
        sms_log_id: recentSuccess.id,
        duplicate: true
      });
    }
    
    // Check if there was a failed attempt recently
    const recentFailure = await SMSLog.findOne({
      where: {
        phone_number,
        message: {
          [Op.like]: `%${tracking_number}%`
        },
        status: { [Op.in]: ['failed', 'error'] },
        created_at: {
          [Op.gte]: new Date(Date.now() - 1 * 60 * 1000) // Last 1 minute only
        }
      }
    });

    if (recentFailure) {
      console.log("⚠️ Recent failure detected, allowing retry...");
      // Allow retry after failure
    }
    
    // Use the SMS service
    const result = await smsService.sendPickupNotification({
      tracking_number,
      phone_number,
      receiver_name,
      branchId,
      companyId
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error("❌ Error in sendPickupNotification:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
  // Confirm trip arrival and update all parcels
  confirmTripArrival = catchAsync(async (req, res) => {
    try {
      console.log("=".repeat(60));
      console.log("🔥🔥🔥 CONFIRM ARRIVAL ENDPOINT HIT 🔥🔥🔥");
      console.log("=".repeat(60));
      console.log("📋 Request params:", req.params);
      console.log("📋 Trip ID from params:", req.params.tripId);
      console.log("👤 User:", req.user.email);
      console.log("📍 Branch ID:", req.user.branch_id);
      
      const { tripId } = req.params;
      const branchId = req.user.branch_id;
      const companyId = req.user.company_id;
      
      // Get sequelize from models
      const { sequelize } = require('../models');
      
      if (!tripId) {
        console.log("❌ No tripId provided in params");
        return res.status(400).json({
          success: false,
          message: 'Trip ID is required'
        });
      }
      
      console.log("🔍 Looking for trip with ID:", tripId);
      
      // Find the trip with vehicle and driver info
      const trip = await Trip.findOne({
        where: { 
          id: tripId,
          company_id: companyId
        },
        include: [
          {
            model: Vehicle,
            as: 'tripVehicle',
            attributes: ['id', 'plate_number', 'status']
          },
          {
            model: Driver,
            as: 'tripDriver',
            attributes: ['id', 'name', 'status']
          }
        ]
      });
      
      if (!trip) {
        console.log("❌ Trip not found with ID:", tripId);
        
        // List all trips to help debug
        const allTrips = await Trip.findAll({
          where: { company_id: companyId },
          attributes: ['id', 'trip_number', 'status'],
          limit: 5
        });
        console.log("📋 Recent trips in DB:", allTrips.map(t => ({
          id: t.id,
          trip_number: t.trip_number,
          status: t.status
        })));
        
        return res.status(404).json({
          success: false,
          message: `Trip not found with ID: ${tripId}`
        });
      }
      
      console.log("✅ Trip found:", {
        id: trip.id,
        trip_number: trip.trip_number,
        current_status: trip.status,
        destination_branch: trip.destination_branch_id,
        vehicle: trip.tripVehicle?.plate_number,
        driver: trip.tripDriver?.name
      });
      
      // Check if this trip is destined for this branch
      if (trip.destination_branch_id !== branchId) {
        console.log("❌ Branch mismatch! Trip destined for:", trip.destination_branch_id);
        console.log("   Current branch:", branchId);
        return res.status(403).json({
          success: false,
          message: 'This trip is not destined for your branch'
        });
      }
      
      // Count parcels BEFORE update
      const parcelsBefore = await Parcel.count({
        where: { trip_id: tripId }
      });
      console.log(`📦 Total parcels in trip before update: ${parcelsBefore}`);
      
      // List parcels BEFORE update
      const parcelsList = await Parcel.findAll({
        where: { trip_id: tripId },
        attributes: ['id', 'tracking_number', 'status']
      });
      
      console.log("📋 Parcels before update:");
      parcelsList.forEach(p => {
        console.log(`   - ${p.tracking_number}: ${p.status}`);
      });
      
      // Start a transaction
      const transaction = await sequelize.transaction();
      
      try {
        // Update trip status to arrived
        await trip.update({
          status: 'arrived',
          arrival_time: new Date()
        }, { transaction });
        
        console.log("✅ Trip status updated to arrived");
        
        // Reset vehicle status to 'active'
        if (trip.vehicle_id) {
          await Vehicle.update(
            { status: 'active' },
            { where: { id: trip.vehicle_id }, transaction }
          );
          console.log(`✅ Vehicle ${trip.tripVehicle?.plate_number} reset to active`);
        }
        
        // Reset driver status to 'active'
        if (trip.driver_id) {
          await Driver.update(
            { status: 'active' },
            { where: { id: trip.driver_id }, transaction }
          );
          console.log(`✅ Driver ${trip.tripDriver?.name} reset to active`);
        }
        
        // Update ALL parcels in this trip to 'arrived' status
        const [updatedCount] = await Parcel.update(
          { 
            status: 'arrived',
            updated_at: new Date()
          },
          {
            where: { trip_id: tripId },
            transaction
          }
        );
        
        console.log(`✅ ${updatedCount} parcels updated to arrived status`);
        
        await transaction.commit();
        
        // Verify after update
        const parcelsAfter = await Parcel.findAll({
          where: { trip_id: tripId },
          attributes: ['id', 'tracking_number', 'status']
        });
        
        console.log("📋 Parcels after update:");
        parcelsAfter.forEach(p => {
          console.log(`   - ${p.tracking_number}: ${p.status}`);
        });
        
        res.status(200).json({
          success: true,
          message: `Trip confirmed arrived. ${updatedCount} parcels updated.`,
          data: {
            trip_id: tripId,
            parcels_updated: updatedCount,
            total_parcels: parcelsBefore
          }
        });
        
      } catch (error) {
        await transaction.rollback();
        console.error("❌ Transaction error:", error);
        throw error;
      }
      
    } catch (error) {
      console.error("❌ Error confirming trip arrival:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
}

module.exports = new BranchTripController();