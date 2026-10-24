const { Parcel, Branch, Trip, Vehicle, Driver, Wallet, sequelize } = require('../models'); // Make sure sequelize is exported from models
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util'); // Add this import
const logger = require('../utils/logger.util');
const { HTTP_STATUS } = require('../config/constants');

class BranchParcelService {
  // Get all branches for the company
  async getBranches(companyId) {
    try {
      console.log("🔍 Service - Fetching branches for company:", companyId);
      
      const branches = await Branch.findAll({
        where: { 
          company_id: companyId,
          is_active: true 
        },
        attributes: ['id', 'name', 'code', 'town'],
        order: [['name', 'ASC']]
      });

      console.log(`✅ Service - Found ${branches.length} branches`);
      return branches;
    } catch (error) {
      logger.error(`Error in getBranches: ${error.message}`);
      throw error;
    }
  }

  // Get available trips
  async getAvailableTrips(companyId) {
    try {
      // Assuming you have a Trip model - adjust as needed
      const trips = await Trip?.findAll?.({
        where: { 
          company_id: companyId,
          status: 'scheduled' 
        },
        include: [
          {
            model: Vehicle,
            as: 'tripVehicle',
            attributes: ['plate_number']
          },
          {
            model: Driver,
            as: 'tripDriver',
            attributes: ['name']
          }
        ],
        limit: 10
      }) || [];

      return trips.map(t => ({
        id: t.id,
        trip_number: t.trip_number,
        route: `${t.origin} → ${t.destination}`,
        vehicle_plate: t.tripVehicle?.plate_number || 'Unknown',
        driver_name: t.tripDriver?.name || 'Unknown'
      }));
    } catch (error) {
      logger.error(`Error in getAvailableTrips: ${error.message}`);
      return []; // Return empty array if trips not implemented
    }
  }

  // Generate tracking number
  async generateTrackingNumber(branchId, destinationCode) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get branch code
    const branch = await Branch.findByPk(branchId, {
      attributes: ['code']
    });
    
    const originCode = branch?.code || 'XXX';
    const destCode = destinationCode?.slice(0, 3).toUpperCase() || 'XXX';
    
    // Get count of parcels today for sequence
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const count = await Parcel.count({
      where: {
        created_at: { [Op.gte]: startOfDay }
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    
    return `${originCode}${destCode}${year}${month}${day}${sequence}`;
  }

  // Create new parcel with wallet deduction
 // In branchParcel.service.js - update the createParcel method
// In branchParcel.service.js - update the createParcel method

async createParcel(branchId, companyId, userId, data) {
  console.log("=".repeat(50));
  console.log("🔧 SERVICE: createParcel called with wallet deduction");
  console.log("=".repeat(50));

  const transaction = await sequelize.transaction();

  try {
    const {
      sender_name, sender_phone,
      receiver_name, receiver_phone,
      description, destination_branch,
      weight, amount,
      payment_method, payment_status,
      trip_id
    } = data;

    // ALWAYS deduct platform fee for EVERY booking regardless of payment status
    console.log("💰 Checking wallet balance for platform fee...");
    
    // Find the company wallet with lock to prevent race conditions
    const wallet = await Wallet.findOne({
      where: { company_id: companyId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    console.log("💰 Wallet found:", wallet ? {
      id: wallet.id,
      balance: wallet.balance,
      total_deductions: wallet.total_deductions
    } : 'No wallet found');

    if (!wallet) {
      throw new AppError('Company wallet not found', HTTP_STATUS.NOT_FOUND);
    }

    // Check if balance is sufficient for platform fee
    const currentBalance = Number(wallet.balance);
    console.log(`💰 Current balance: KES ${currentBalance}`);
    
    if (currentBalance < 5) {
      throw new AppError(
        `Insufficient wallet balance. Current balance: KES ${currentBalance}. Minimum required: KES 5.`, 
        HTTP_STATUS.BAD_REQUEST
      );
    }

    console.log("💰 Deducting KES 5 platform fee from wallet...");
    
    // Call debit method with explicit parameters
    await wallet.debit(
      5,                           // amount
      `Parcel booking platform fee (Payment: ${payment_status})`, // description with payment status
      null,                        // reference (can be parcel tracking number later)
      userId,                      // user who performed the action
      transaction                  // transaction
    );
    
    console.log("✅ Platform fee deducted successfully");
    
    // Verify the update immediately
    const updatedWallet = await Wallet.findOne({
      where: { company_id: companyId },
      transaction
    });
    
    console.log("💰 Updated wallet after deduction:", {
      balance: updatedWallet.balance,
      total_deductions: updatedWallet.total_deductions
    });

    // Generate tracking number
    console.log("🔢 Generating tracking number...");
    const destinationBranch = await Branch.findByPk(destination_branch);
    const trackingNumber = await this.generateTrackingNumber(branchId, destinationBranch?.code);
    console.log("✅ Tracking number generated:", trackingNumber);

    // Create parcel
    console.log("📦 Creating parcel in database...");
    const parcel = await Parcel.create({
      company_id: companyId,
      origin_branch: branchId,
      destination_branch: destination_branch,
      tracking_number: trackingNumber,
      sender_name,
      sender_phone,
      receiver_name,
      receiver_phone,
      description,
      weight: weight || null,
      amount,
      payment_method,
      payment_status,
      trip_id: trip_id || null,
      status: 'pending',
      parcel_count: 1
    }, { transaction });

    console.log("✅ Parcel created in DB:", parcel.toJSON());

    await transaction.commit();
    console.log("✅ Transaction committed");

    // Get branch names for response
    const originBranch = await Branch.findByPk(branchId);
    const destBranch = await Branch.findByPk(destination_branch);

    // Get final wallet balance
    const finalWallet = await Wallet.findOne({
      where: { company_id: companyId }
    });

    const response = {
      id: parcel.id,
      tracking_number: parcel.tracking_number,
      sender_name: parcel.sender_name,
      sender_phone: parcel.sender_phone,
      receiver_name: parcel.receiver_name,
      receiver_phone: parcel.receiver_phone,
      description: parcel.description,
      origin_branch: originBranch?.name,
      destination_branch: destBranch?.name,
      weight: parcel.weight,
      amount: parcel.amount,
      payment_method: parcel.payment_method,
      payment_status: parcel.payment_status,
      status: parcel.status,
      created_at: parcel.created_at,
      wallet_balance: finalWallet?.balance || 0
    };

    console.log("📤 Returning response with wallet balance:", finalWallet?.balance);
    return response;
  } catch (error) {
    console.error("❌ Error in createParcel service:", error);
    console.error("Error stack:", error.stack);
    await transaction.rollback();
    console.log("🔄 Transaction rolled back");
    throw error;
  }
}
  // Get wallet info
  async getWalletInfo(companyId) {
    try {
      const wallet = await Wallet.findOne({
        where: { company_id: companyId },
        attributes: ['balance', 'total_credits', 'total_deductions']
      });

      return {
        balance: parseFloat(wallet?.balance) || 0,
        total_credits: parseFloat(wallet?.total_credits) || 0,
        total_deductions: parseFloat(wallet?.total_deductions) || 0,
        low_balance: (parseFloat(wallet?.balance) || 0) < 500
      };
    } catch (error) {
      logger.error(`Error in getWalletInfo: ${error.message}`);
      return { 
        balance: 0, 
        total_credits: 0, 
        total_deductions: 0,
        low_balance: false 
      };
    }
  }
}

module.exports = new BranchParcelService();