const branchParcelService = require('../services/branchParcel.service');
const receiptService = require('../services/receipt.service');
const catchAsync = require('../utils/catchAsync.util');
const { HTTP_STATUS } = require('../config/constants');
const logger = require('../utils/logger.util');
const { body, validationResult } = require('express-validator');
const { Branch, Company, User, Parcel, Trip, Vehicle, Driver, Transaction,sequelize } = require('../models'); // Added missing models
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util');

class BranchParcelController {
  // Validation rules for creating parcel
  validateCreate = [
    body('sender_name').trim().notEmpty().withMessage('Sender name is required'),
    body('sender_phone').trim().notEmpty().withMessage('Sender phone is required'),
    body('receiver_name').trim().notEmpty().withMessage('Receiver name is required'),
    body('receiver_phone').trim().notEmpty().withMessage('Receiver phone is required'),
    body('destination_branch').notEmpty().withMessage('Destination branch is required'),
    body('amount').isNumeric().withMessage('Amount must be a number').custom(v => v > 0).withMessage('Amount must be greater than 0'),
    body('payment_status').isIn(['paid', 'pending', 'destination']).withMessage('Invalid payment status')
  ];

  // get branches
  getBranches = async (req, res) => {
    try {
      console.log("🔍 Getting branches for company:", req.user.company_id);
      console.log("👤 Current user branch:", req.user.branch_id);
      
      const companyId = req.user.company_id;
      const currentBranchId = req.user.branch_id;
      
      const branches = await Branch.findAll({
        where: {
          company_id: companyId,
          is_active: true,
          id: { [Op.ne]: currentBranchId }
        },
        attributes: ['id', 'name', 'code', 'town'],
        order: [['name', 'ASC']]
      });
      
      console.log(`✅ Found ${branches.length} branches`);
      
      res.json({
        success: true,
        data: branches
      });
    } catch (error) {
      console.error("❌ Error in getBranches:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  // Get available trips
  getAvailableTrips = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const trips = await branchParcelService.getAvailableTrips(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: trips
    });
  });

  // Create new parcel - UPDATED WITH RECEIPT
  createParcel = catchAsync(async (req, res) => {
    console.log("=".repeat(50));
    console.log("🎯 BACKEND: Create parcel endpoint hit");
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
      
      // Create the parcel
      const parcel = await branchParcelService.createParcel(branchId, companyId, userId, req.body);
      
      console.log("✅ Parcel created successfully:", JSON.stringify(parcel, null, 2));
      
      // Fetch additional data for receipt
      console.log("📋 Fetching receipt data...");
      
      const [user, company, originBranch, destBranch] = await Promise.all([
        User.findByPk(userId),
        Company.findByPk(companyId),
        Branch.findByPk(branchId),
        Branch.findByPk(req.body.destination_branch)
      ]);
      
      console.log("👤 User for receipt:", user?.full_name);
      console.log("🏢 Company for receipt:", company?.name);
      console.log("📍 Origin branch:", originBranch?.name);
      console.log("🎯 Destination branch:", destBranch?.name);
      
      // Generate receipt
      console.log("🧾 Generating receipt...");
      const receipt = receiptService.generateReceipt(
        parcel, 
        user, 
        company, 
        originBranch, 
        destBranch
      );
      
      console.log("✅ Receipt generated:", receipt.receipt_number);
      
      // Return both parcel and receipt
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Parcel booked successfully',
        data: {
          parcel,
          receipt
        }
      });
    } catch (error) {
      console.error("❌ Error in createParcel:", error);
      console.error("Error stack:", error.stack);
      
      if (error instanceof AppError) {
        return res.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to create parcel'
      });
    }
  });

  // Get wallet info
  getWalletInfo = catchAsync(async (req, res) => {
    const companyId = req.user.company_id;
    
    const wallet = await branchParcelService.getWalletInfo(companyId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: wallet
    });
  });

  // Get all parcels with pagination and filters
  getAllParcels = catchAsync(async (req, res) => {
    try {
      const branchId = req.user.branch_id;
      const companyId = req.user.company_id;
      const { page = 1, limit = 10, status, search } = req.query;
      
      console.log("📋 Fetching parcels for branch:", branchId);
      
      const where = {
        company_id: companyId,
        origin_branch: branchId
      };
      
      if (status && status !== 'all') {
        where.status = status;
      }
      
      if (search) {
        where[Op.or] = [
          { tracking_number: { [Op.iLike]: `%${search}%` } },
          { sender_name: { [Op.iLike]: `%${search}%` } },
          { receiver_name: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      const { count, rows } = await Parcel.findAndCountAll({
        where,
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
      
      const parcels = rows.map(p => ({
        id: p.id,
        tracking_number: p.tracking_number,
        sender_name: p.sender_name,
        sender_phone: p.sender_phone,
        receiver_name: p.receiver_name,
        receiver_phone: p.receiver_phone,
        description: p.description,
        origin_branch: 'Nairobi CBD',
        destination_branch: p.destinationBranch?.name || 'Unknown',
        weight: p.weight,
        amount: p.amount,
        payment_method: p.payment_method,
        payment_status: p.payment_status,
        status: p.status,
        created_at: p.created_at
      }));
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          data: parcels
        }
      });
    } catch (error) {
      console.error("❌ Error in getAllParcels:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // Preview tracking number
  previewTracking = catchAsync(async (req, res) => {
    const { destination } = req.query;
    const branchId = req.user.branch_id;
    
    const trackingNumber = await branchParcelService.generateTrackingNumber(branchId, destination);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { tracking_number: trackingNumber }
    });
  });

  // Get parcel by tracking number
// In branchParcel.controller.js - update getParcelByTracking

getParcelByTracking = catchAsync(async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const branchId = req.user.branch_id;
    
    console.log("=".repeat(50));
    console.log("🔍 Fetching parcel by tracking:", trackingNumber);
    console.log("=".repeat(50));
    
    // First, let's do a raw query to see exactly what's in the database
    const [rawResults] = await sequelize.query(
      'SELECT * FROM parcels WHERE tracking_number = :trackingNumber',
      {
        replacements: { trackingNumber },
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    console.log("📦 Raw database result:", rawResults);
    
    if (!rawResults) {
      console.log("❌ No parcel found in database");
      return res.status(404).json({
        success: false,
        message: 'Parcel not found'
      });
    }
    
    console.log("📝 Raw description from DB:", rawResults.description);
    
    // Now do the full query with associations
    const parcel = await Parcel.findOne({
      where: { tracking_number: trackingNumber },
      include: [
        {
          model: Branch,
          as: 'originBranch',
          attributes: ['name', 'town', 'code']
        },
        {
          model: Branch,
          as: 'destinationBranch',
          attributes: ['name', 'town', 'code']
        },
        {
          model: Trip,
          as: 'trip',
          required: false,
          include: [
            {
              model: Vehicle,
              as: 'tripVehicle',
              attributes: ['plate_number', 'type']
            },
            {
              model: Driver,
              as: 'tripDriver',
              attributes: ['name', 'phone']
            }
          ]
        }
      ]
    });
    
    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: 'Parcel not found'
      });
    }
    
    // Log the full parcel object
    console.log("📦 Sequelize parcel object:", parcel.toJSON());
    console.log("📝 Sequelize description:", parcel.description);
    
    // Verify parcel is destined for this branch
    if (parcel.destination_branch !== branchId) {
      console.log("❌ Parcel destined for different branch");
      return res.status(403).json({
        success: false,
        message: 'This parcel is not destined for your branch'
      });
    }
    
    // Format the response with explicit description
    const formattedParcel = {
      id: parcel.id,
      tracking_number: parcel.tracking_number,
      sender_name: parcel.sender_name,
      sender_phone: parcel.sender_phone,
      receiver_name: parcel.receiver_name,
      receiver_phone: parcel.receiver_phone,
      description: parcel.description || rawResults?.description || null, // Use both sources
      origin_branch: parcel.originBranch?.name || 'Unknown',
      destination_branch: parcel.destinationBranch?.name || 'Unknown',
      weight: parcel.weight,
      amount: parcel.amount,
      payment_method: parcel.payment_method,
      payment_status: parcel.payment_status,
      status: parcel.status,
      created_at: parcel.created_at,
      updated_at: parcel.updated_at,
      trip: parcel.trip ? {
        trip_number: parcel.trip.trip_number,
        vehicle_plate: parcel.trip.tripVehicle?.plate_number,
        driver_name: parcel.trip.tripDriver?.name,
        driver_phone: parcel.trip.tripDriver?.phone
      } : null
    };
    
    console.log("✅ Formatted parcel description:", formattedParcel.description);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: formattedParcel
    });
    
  } catch (error) {
    console.error("❌ Error in getParcelByTracking:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch parcel'
    });
  }
});
  // Collect payment for parcel
  collectPayment = catchAsync(async (req, res) => {
    try {
      const { parcel_id, payment_method, amount } = req.body;
      const userId = req.user.id;
      
      console.log("💰 Collecting payment for parcel:", parcel_id);
      
      const parcel = await Parcel.findByPk(parcel_id);
      
      if (!parcel) {
        return res.status(404).json({
          success: false,
          message: 'Parcel not found'
        });
      }
      
      // Update parcel payment status
      await parcel.update({
        payment_status: 'paid',
        payment_method: payment_method
      });
      
      // Record transaction (comment out if Transaction model doesn't exist yet)
      // await Transaction.create({
      //   parcel_id: parcel.id,
      //   amount: amount,
      //   payment_method: payment_method,
      //   collected_by: userId,
      //   collected_at: new Date()
      // });
      
      console.log("✅ Payment collected successfully");
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payment collected successfully'
      });
    } catch (error) {
      console.error("❌ Error in collectPayment:", error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to collect payment'
      });
    }
  });

  // Release parcel
 // In branchParcel.controller.js - update releaseParcel

releaseParcel = catchAsync(async (req, res) => {
  try {
    console.log("=".repeat(50));
    console.log("🎯 RELEASE PARCEL ENDPOINT HIT");
    console.log("=".repeat(50));
    
    const {
      parcel_id,
      collector_name,
      collector_id_number,
      collector_phone,
      relationship,
      payment_method
    } = req.body;
    
    const userId = req.user.id;
    const branchId = req.user.branch_id;
    const companyId = req.user.company_id;
    
    console.log("📦 Parcel ID:", parcel_id);
    console.log("👤 Collector:", { collector_name, collector_id_number, collector_phone, relationship });
    console.log("💰 Payment Method:", payment_method);
    
    // Find the parcel with all fields
    const parcel = await Parcel.findByPk(parcel_id);
    
    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: 'Parcel not found'
      });
    }
    
    console.log("📦 Parcel found:", {
      id: parcel.id,
      tracking: parcel.tracking_number,
      description: parcel.description,
      status: parcel.status
    });
    
    // Verify parcel belongs to this branch
    if (parcel.destination_branch !== branchId) {
      return res.status(403).json({
        success: false,
        message: 'This parcel does not belong to your branch'
      });
    }
    
    // Verify parcel is in arrived status
    if (parcel.status !== 'arrived') {
      return res.status(400).json({
        success: false,
        message: 'Parcel must be in "arrived" status to release'
      });
    }
    
    // Update parcel status
    await parcel.update({
      status: 'delivered',
      released_at: new Date(),
      released_by: userId,
      collector_name,
      collector_id_number,
      collector_phone,
      collector_relationship: relationship,
      payment_method: payment_method || parcel.payment_method,
      payment_status: 'paid'
    });
    
    console.log("✅ Parcel updated to delivered");
    
    // Get data for receipt
    const [user, company, branch, originBranch] = await Promise.all([
      User.findByPk(userId),
      Company.findByPk(companyId),
      Branch.findByPk(branchId),
      Branch.findByPk(parcel.origin_branch)
    ]);
    
    console.log("👤 User for receipt:", user?.full_name);
    console.log("🏢 Company for receipt:", company?.name);
    console.log("📍 Branch for receipt:", branch?.name);
    console.log("📍 Origin branch for receipt:", originBranch?.name);
    
    // Refresh parcel data to get all fields
    const refreshedParcel = await Parcel.findByPk(parcel_id);
    
    console.log("📦 Refreshed parcel description:", refreshedParcel.description);
    
    // Prepare parcel data for receipt with explicit description
    const parcelData = {
      ...refreshedParcel.toJSON(),
      origin_branch_name: originBranch?.name,
      destination_branch_name: branch?.name,
      description: refreshedParcel.description || null // Explicitly include description
    };
    
    // Generate release receipt
    const receipt = receiptService.generateReleaseReceipt(
      parcelData,
      user,
      company,
      branch,
      {
        name: collector_name,
        id_number: collector_id_number,
        phone: collector_phone,
        relationship
      },
      payment_method
    );
    
    console.log("✅ Release receipt generated:", receipt.receipt_number);
    console.log("📝 Receipt description:", receipt.parcel?.description);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Parcel released successfully',
      data: { receipt }
    });
    
  } catch (error) {
    console.error("❌ Error in releaseParcel:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to release parcel'
    });
  }
});
}

module.exports = new BranchParcelController();