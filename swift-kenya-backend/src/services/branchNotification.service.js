const { Parcel } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger.util');

class BranchNotificationService {
  async getNotifications(branchId, companyId) {
    try {
      // Count pending pickups (parcels waiting to be picked up at this branch)
      const pendingPickups = await Parcel.count({
        where: {
          origin_branch: branchId,
          status: 'pending',
          company_id: companyId
        }
      });

      // Count pending deliveries (parcels waiting to be delivered at this branch)
      const pendingDeliveries = await Parcel.count({
        where: {
          destination_branch: branchId,
          status: 'in_transit',
          company_id: companyId
        }
      });

      // Get recent alerts (parcels that have been in pending for more than 2 days)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const staleParcels = await Parcel.findAll({
        where: {
          [Op.or]: [
            { origin_branch: branchId, status: 'pending' },
            { destination_branch: branchId, status: 'in_transit' }
          ],
          created_at: { [Op.lt]: twoDaysAgo },
          company_id: companyId
        },
        limit: 5,
        order: [['created_at', 'ASC']],
        attributes: ['id', 'tracking_number', 'status', 'created_at']
      });

      const recentAlerts = staleParcels.map(p => ({
        id: p.id,
        type: p.status === 'pending' ? 'pickup' : 'delivery',
        message: `Parcel ${p.tracking_number} has been ${p.status} for over 2 days`,
        created_at: p.created_at
      }));

      return {
        pending_pickups: pendingPickups,
        pending_deliveries: pendingDeliveries,
        recent_alerts: recentAlerts
      };
    } catch (error) {
      logger.error(`Error in getNotifications: ${error.message}`);
      return {
        pending_pickups: 0,
        pending_deliveries: 0,
        recent_alerts: []
      };
    }
  }
}

module.exports = new BranchNotificationService();