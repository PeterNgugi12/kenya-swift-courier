const { sequelize } = require('../config/database');
const { Parcel, Vehicle, Driver, Branch, Wallet, Trip } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger.util');

class CompanyDashboardService {
  // Get all dashboard statistics
  async getDashboardStats(companyId) {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

      // Parcels this month
      const parcelsThisMonth = await Parcel.count({
        where: {
          company_id: companyId,
          created_at: { [Op.gte]: startOfMonth }
        }
      });

      // Parcels last month for growth calculation
      const parcelsLastMonth = await Parcel.count({
        where: {
          company_id: companyId,
          created_at: {
            [Op.between]: [startOfLastMonth, endOfLastMonth]
          }
        }
      });

      const parcelsChange = parcelsLastMonth > 0 
        ? ((parcelsThisMonth - parcelsLastMonth) / parcelsLastMonth) * 100 
        : 0;

      // Revenue this month
      const revenueThisMonth = await Parcel.sum('amount', {
        where: {
          company_id: companyId,
          created_at: { [Op.gte]: startOfMonth }
        }
      });

      // Vehicle stats
      const vehicles = await Vehicle.findAll({
        where: { company_id: companyId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
          ), 'active'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'maintenance' THEN 1 END")
          ), 'maintenance']
        ],
        raw: true
      });

      // Driver stats
      const drivers = await Driver.findAll({
        where: { company_id: companyId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
          ), 'active'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'on_leave' THEN 1 END")
          ), 'on_leave']
        ],
        raw: true
      });

      // Wallet balance
      const wallet = await Wallet.findOne({
        where: { company_id: companyId },
        attributes: ['balance']
      });

      // Weekly data
      const weeklyData = await this.getWeeklyData(companyId);

      // Branch performance
      const branchPerformance = await this.getBranchPerformance(companyId);

      // Recent trips
      const recentTrips = await this.getRecentTrips(companyId);
      const activeTripsCount = recentTrips.filter(t => 
        t.status === 'in_transit' || t.status === 'departed'
      ).length;

      return {
        parcels_this_month: parcelsThisMonth || 0,
        parcels_change: parseFloat(parcelsChange.toFixed(1)),
        revenue_this_month: parseFloat(revenueThisMonth) || 0,
        revenue_rate: 5, // KES per parcel
        active_vehicles: parseInt(vehicles[0]?.active) || 0,
        total_vehicles: parseInt(vehicles[0]?.total) || 0,
        vehicles_in_maintenance: parseInt(vehicles[0]?.maintenance) || 0,
        active_drivers: parseInt(drivers[0]?.active) || 0,
        drivers_on_leave: parseInt(drivers[0]?.on_leave) || 0,
        wallet_balance: parseFloat(wallet?.balance) || 0,
        wallet_low_balance: (parseFloat(wallet?.balance) || 0) < 500,
        weekly_data: weeklyData,
        branch_performance: branchPerformance,
        recent_trips: recentTrips,
        active_trips_count: activeTripsCount
      };
    } catch (error) {
      logger.error(`Error in getDashboardStats: ${error.message}`);
      throw error;
    }
  }

  // Get weekly parcel data
  async getWeeklyData(companyId) {
    try {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const result = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await Parcel.count({
          where: {
            company_id: companyId,
            created_at: {
              [Op.between]: [date, nextDate]
            }
          }
        });

        result.push({
          day: days[date.getDay()],
          parcels: count
        });
      }

      return result;
    } catch (error) {
      logger.error(`Error in getWeeklyData: ${error.message}`);
      return [];
    }
  }

  // Get branch performance
  async getBranchPerformance(companyId) {
    try {
      const branches = await Branch.findAll({
        where: { company_id: companyId, is_active: true },
        attributes: ['id', 'name']
      });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const branchData = await Promise.all(
        branches.map(async (branch) => {
          const parcelCount = await Parcel.count({
            where: {
              [Op.or]: [
                { origin_branch: branch.id },
                { destination_branch: branch.id }
              ],
              created_at: { [Op.gte]: startOfMonth }
            }
          });

          return {
            branch_id: branch.id,
            branch_name: branch.name,
            parcels: parcelCount
          };
        })
      );

      // Calculate percentages
      const maxParcels = Math.max(...branchData.map(b => b.parcels), 1);
      
      return branchData.map(b => ({
        branch_name: b.branch_name,
        parcels: b.parcels,
        percentage: Math.round((b.parcels / maxParcels) * 100)
      })).sort((a, b) => b.parcels - a.parcels);
    } catch (error) {
      logger.error(`Error in getBranchPerformance: ${error.message}`);
      return [];
    }
  }

  // Get recent trips
 // Get recent trips
// Get recent trips
// Alternative: Get recent trips via parcels
// Get recent trips
async getRecentTrips(companyId) {
  try {
    const recentParcels = await Parcel.findAll({
      where: { company_id: companyId },
      include: [
        {
          model: Branch,
          as: 'originBranch',
          attributes: ['name', 'code']
        },
        {
          model: Branch,
          as: 'destinationBranch',
          attributes: ['name', 'code']
        },
        {
          model: Trip,
          as: 'trip',
          include: [
            {
              model: Vehicle,
              as: 'tripVehicle',
              attributes: ['plate_number', 'type'] // Changed from 'model' to 'type'
            },
            {
              model: Driver,
              as: 'tripDriver',
              attributes: ['name'] // Drivers have 'name' field, not first_name/last_name
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 10,
      attributes: ['id', 'tracking_number', 'status', 'parcel_count', 'created_at', 'trip_id']
    });

    return recentParcels.map(p => {
      const parcel = p.toJSON();
      const trip = parcel.trip;
      
      // Format vehicle info - using plate_number and type
      let vehicleInfo = 'Unassigned';
      if (trip?.tripVehicle) {
        const parts = [];
        if (trip.tripVehicle.plate_number) parts.push(trip.tripVehicle.plate_number);
        if (trip.tripVehicle.type) parts.push(`(${trip.tripVehicle.type})`);
        vehicleInfo = parts.join(' ') || 'Unassigned';
      }
      
      // Format driver info - using name field
      let driverInfo = 'Unassigned';
      if (trip?.tripDriver?.name) {
        driverInfo = trip.tripDriver.name;
      }

      // Get route from trip branches or parcel branches
      let route = 'Route not set';
      if (trip?.originBranch && trip?.destinationBranch) {
        route = `${trip.originBranch.code || '???'} → ${trip.destinationBranch.code || '???'}`;
      } else if (parcel.originBranch && parcel.destinationBranch) {
        route = `${parcel.originBranch.code || '???'} → ${parcel.destinationBranch.code || '???'}`;
      }

      return {
        id: parcel.tracking_number || parcel.id,
        trip_id: trip?.trip_number || parcel.tracking_number || `TRIP-${parcel.id?.slice(0, 8) || '0000'}`,
        route: route,
        vehicle: vehicleInfo,
        driver: driverInfo,
        parcels: parcel.parcel_count || 1,
        status: trip?.status || parcel.status || 'pending',
        created_at: parcel.created_at
      };
    });
  } catch (error) {
    logger.error(`Error in getRecentTrips: ${error.message}`);
    return [];
  }
}

  // Get wallet info
  async getWalletInfo(companyId) {
    try {
      const wallet = await Wallet.findOne({
        where: { company_id: companyId },
        attributes: ['balance']
      });

      return {
        balance: parseFloat(wallet?.balance) || 0,
        low_balance: (parseFloat(wallet?.balance) || 0) < 500
      };
    } catch (error) {
      logger.error(`Error in getWalletInfo: ${error.message}`);
      return { balance: 0, low_balance: false };
    }
  }
}

module.exports = new CompanyDashboardService();