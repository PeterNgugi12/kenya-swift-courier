const { sequelize } = require('../config/database'); // ✅ ADD THIS IMPORT
const User = require('./User');
const Company = require('./Company');
const Wallet = require('./Wallet');
const WalletTransaction = require('./WalletTransaction');
const Branch = require('./Branch');
const Vehicle = require('./Vehicle');
const Driver = require('./Driver');
const Parcel = require('./Parcel');
const SMSLog = require('./SMSLog');
const Trip = require('./Trip');

// ==================== USER ASSOCIATIONS ====================
User.belongsTo(Company, { foreignKey: 'company_id', as: 'userCompany' });
Company.hasMany(User, { foreignKey: 'company_id', as: 'companyUsers' });

User.belongsTo(Branch, { foreignKey: 'branch_id', as: 'userBranch' });
Branch.hasMany(User, { foreignKey: 'branch_id', as: 'branchUsers' });

// ==================== COMPANY ASSOCIATIONS ====================
Company.hasOne(Wallet, { foreignKey: 'company_id', as: 'companyWallet' });
Wallet.belongsTo(Company, { foreignKey: 'company_id', as: 'walletCompany' });

Company.hasMany(Branch, { foreignKey: 'company_id', as: 'companyBranches' });
Branch.belongsTo(Company, { foreignKey: 'company_id', as: 'branchCompany' });

// Vehicle - Company
Company.hasMany(Vehicle, { foreignKey: 'company_id', as: 'companyVehicles' });
Vehicle.belongsTo(Company, { foreignKey: 'company_id', as: 'vehicleCompany' });

// Driver - Company
Company.hasMany(Driver, { foreignKey: 'company_id', as: 'companyDrivers' });
Driver.belongsTo(Company, { foreignKey: 'company_id', as: 'driverCompany' });

// Trip - Company
Company.hasMany(Trip, { foreignKey: 'company_id', as: 'companyTrips' });
Trip.belongsTo(Company, { foreignKey: 'company_id', as: 'tripCompany' });

Company.hasMany(Parcel, { foreignKey: 'company_id', as: 'companyParcels' });
Parcel.belongsTo(Company, { foreignKey: 'company_id', as: 'parcelCompany' });

Company.hasMany(SMSLog, { foreignKey: 'company_id', as: 'companySMSLogs' });
SMSLog.belongsTo(Company, { foreignKey: 'company_id', as: 'smsCompany' });

// ==================== WALLET ASSOCIATIONS ====================
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'walletTransactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'transactionWallet' });
WalletTransaction.belongsTo(Company, { foreignKey: 'company_id', as: 'transactionCompany' });
WalletTransaction.belongsTo(User, { foreignKey: 'created_by', as: 'createdByUser' });

// ==================== BRANCH ASSOCIATIONS ====================
Branch.hasMany(Vehicle, { foreignKey: 'branch_id', as: 'branchVehicles' });
Vehicle.belongsTo(Branch, { foreignKey: 'branch_id', as: 'vehicleBranch' });

Branch.hasMany(Driver, { foreignKey: 'branch_id', as: 'branchDrivers' });
Driver.belongsTo(Branch, { foreignKey: 'branch_id', as: 'driverBranch' });

Branch.hasMany(Parcel, { foreignKey: 'origin_branch', as: 'originParcels' });
Branch.hasMany(Parcel, { foreignKey: 'destination_branch', as: 'destinationParcels' });

// Branch - Trip associations
Branch.hasMany(Trip, { foreignKey: 'origin_branch_id', as: 'originTrips' });
Branch.hasMany(Trip, { foreignKey: 'destination_branch_id', as: 'destinationTrips' });
Trip.belongsTo(Branch, { foreignKey: 'origin_branch_id', as: 'originBranch' });
Trip.belongsTo(Branch, { foreignKey: 'destination_branch_id', as: 'destinationBranch' });

// ==================== VEHICLE ASSOCIATIONS ====================
Vehicle.belongsTo(Driver, { foreignKey: 'driver_id', as: 'vehicleDriver' });
Driver.hasMany(Vehicle, { foreignKey: 'driver_id', as: 'driverVehicles' });

Vehicle.hasMany(Trip, { foreignKey: 'vehicle_id', as: 'vehicleTrips' });
Trip.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'tripVehicle' });

// ==================== DRIVER ASSOCIATIONS ====================
Driver.hasMany(Trip, { foreignKey: 'driver_id', as: 'driverTrips' });
Trip.belongsTo(Driver, { foreignKey: 'driver_id', as: 'tripDriver' });

// ==================== PARCEL ASSOCIATIONS ====================
Parcel.belongsTo(Branch, { foreignKey: 'origin_branch', as: 'originBranch' });
Parcel.belongsTo(Branch, { foreignKey: 'destination_branch', as: 'destinationBranch' });
Parcel.hasMany(SMSLog, { foreignKey: 'parcel_id', as: 'parcelSMSLogs' });

Parcel.belongsTo(Trip, { foreignKey: 'trip_id', as: 'trip' });
Trip.hasMany(Parcel, { foreignKey: 'trip_id', as: 'parcels' });

// ==================== SMS LOG ASSOCIATIONS ====================
SMSLog.belongsTo(Parcel, { foreignKey: 'parcel_id', as: 'smsParcel' });

// ✅ EXPORT SEQUELIZE ALONG WITH ALL MODELS
module.exports = {
  sequelize, // ✅ ADD THIS LINE
  User,
  Company,
  Wallet,
  WalletTransaction,
  Branch,
  Vehicle,
  Driver,
  Parcel,
  SMSLog,
  Trip
};