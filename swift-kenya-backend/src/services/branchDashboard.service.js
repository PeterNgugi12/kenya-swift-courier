const { Parcel, Trip, Branch, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger.util');

class BranchDashboardService {
  // Get dashboard statistics
  async getStats(branchId, companyId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Booked today
      const bookedToday = await Parcel.count({
        where: {
          origin_branch: branchId,
          company_id: companyId,
          created_at: { [Op.gte]: today }
        }
      });

      // Booked yesterday (for change calculation)
      const bookedYesterday = await Parcel.count({
        where: {
          origin_branch: branchId,
          company_id: companyId,
          created_at: {
            [Op.gte]: yesterday,
            [Op.lt]: today
          }
        }
      });

      const bookedChange = bookedYesterday > 0 
        ? Math.round(((bookedToday - bookedYesterday) / bookedYesterday) * 100)
        : bookedToday > 0 ? 100 : 0;

      // Trips departed today
      const tripsDeparted = await Trip.count({
        where: {
          origin_branch_id: branchId,
          company_id: companyId,
          departure_time: { [Op.gte]: today }
        }
      });

      // Trips in transit
      const tripsInTransit = await Trip.count({
        where: {
          origin_branch_id: branchId,
          company_id: companyId,
          status: 'in_transit'
        }
      });

      // Arrivals today
      const arrivalsToday = await Parcel.count({
        where: {
          destination_branch: branchId,
          company_id: companyId,
          status: 'arrived',
          updated_at: { [Op.gte]: today }
        }
      });

      // Parcels arrived today
      const arrivedParcels = await Parcel.sum('parcel_count', {
        where: {
          destination_branch: branchId,
          company_id: companyId,
          status: 'arrived',
          updated_at: { [Op.gte]: today }
        }
      });

      // Pending pickup
      const pendingPickup = await Parcel.count({
        where: {
          destination_branch: branchId,
          company_id: companyId,
          status: 'arrived'
        }
      });

      // Overdue pickup (arrived more than 2 days ago)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const overduePickup = await Parcel.count({
        where: {
          destination_branch: branchId,
          company_id: companyId,
          status: 'arrived',
          updated_at: { [Op.lt]: twoDaysAgo }
        }
      });

      return {
        booked_today: bookedToday,
        booked_today_change: bookedChange,
        trips_departed: tripsDeparted,
        trips_in_transit: tripsInTransit,
        arrivals_today: arrivalsToday,
        arrived_parcels: arrivedParcels || 0,
        pending_pickup: pendingPickup,
        overdue_pickup: overduePickup
      };
    } catch (error) {
      logger.error(`Error in getStats: ${error.message}`);
      throw error;
    }
  }

  // Get recent parcels
  async getRecentParcels(branchId, companyId, limit = 10) {
    try {
      const parcels = await Parcel.findAll({
        where: {
          [Op.or]: [
            { origin_branch: branchId },
            { destination_branch: branchId }
          ],
          company_id: companyId
        },
        include: [
          {
            model: Branch,
            as: 'destinationBranch',
            attributes: ['name', 'code', 'town']
          }
        ],
        order: [['created_at', 'DESC']],
        limit,
        attributes: [
          'id', 'tracking_number', 'sender_name', 'receiver_name',
          'amount', 'payment_status', 'status', 'created_at'
        ]
      });

      return parcels.map(p => {
        const parcel = p.toJSON();
        return {
          id: parcel.id,
          tracking_number: parcel.tracking_number,
          sender_name: parcel.sender_name,
          receiver_name: parcel.receiver_name,
          destination_branch: parcel.destinationBranch?.name || 'Unknown',
          amount: parseFloat(parcel.amount) || 0,
          payment_status: parcel.payment_status || 'pending',
          status: parcel.status,
          created_at: parcel.created_at
        };
      });
    } catch (error) {
      logger.error(`Error in getRecentParcels: ${error.message}`);
      return [];
    }
  }

  // Get branch info
  async getBranchInfo(branchId) {
    try {
      const branch = await Branch.findByPk(branchId, {
        attributes: ['name', 'code', 'town']
      });

      return branch || { name: 'Branch', code: '', town: '' };
    } catch (error) {
      logger.error(`Error in getBranchInfo: ${error.message}`);
      return { name: 'Branch', code: '', town: '' };
    }
  }

  // Get overdue alerts
  async getOverdueAlerts(branchId, companyId) {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const overdueCount = await Parcel.count({
        where: {
          destination_branch: branchId,
          company_id: companyId,
          status: 'arrived',
          updated_at: { [Op.lt]: twoDaysAgo }
        }
      });

      return {
        count: overdueCount,
        message: overdueCount === 1 
          ? '1 parcel overdue for pickup' 
          : `${overdueCount} parcels overdue for pickup`
      };
    } catch (error) {
      logger.error(`Error in getOverdueAlerts: ${error.message}`);
      return { count: 0, message: 'No overdue parcels' };
    }
  }
}

module.exports = new BranchDashboardService();