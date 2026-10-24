const { sequelize } = require('../config/database');
const { Company, Parcel } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger.util');

class AnalyticsService {
  async getCompanyComparison(months = 6) {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get top 3 companies by total parcel volume in the date range
      const topCompanies = await Company.findAll({
        where: { status: 'active' },
        attributes: [
          'id', 
          'name', 
          'code',
          [sequelize.fn('COUNT', sequelize.col('companyParcels.id')), 'parcel_count']
        ],
        include: [{
          model: Parcel,
          as: 'companyParcels',
          where: {
            created_at: {
              [Op.between]: [startDate, endDate]
            }
          },
          attributes: [],
          required: false
        }],
        group: ['Company.id'],
        order: [[sequelize.literal('parcel_count'), 'DESC']],
        limit: 3,
        subQuery: false,
        raw: true
      });

      if (!topCompanies.length) {
        return [];
      }

      // Get monthly data for each company
      const companiesData = [];
      
      for (const company of topCompanies) {
        const monthlyData = await Parcel.findAll({
          where: {
            company_id: company.id,
            created_at: {
              [Op.between]: [startDate, endDate]
            }
          },
          attributes: [
            [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at'))],
          order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'ASC']],
          raw: true
        });

        companiesData.push({
          id: company.id,
          name: company.name,
          code: company.code,
          monthlyData: monthlyData.reduce((acc, item) => {
            const monthKey = new Date(item.month).toISOString().slice(0, 7); // YYYY-MM format
            acc[monthKey] = parseInt(item.count) || 0;
            return acc;
          }, {})
        });
      }

      // Generate all months in range
      const chartData = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const monthKey = currentDate.toISOString().slice(0, 7);
        const monthShort = currentDate.toLocaleString('default', { month: 'short' });
        
        const row = { 
          month: monthShort,
          fullMonth: monthKey 
        };
        
        companiesData.forEach(company => {
          const companyKey = company.code.toLowerCase();
          row[companyKey] = companiesData.find(c => c.id === company.id)?.monthlyData[monthKey] || 0;
          row[`${companyKey}_name`] = company.name;
        });

        chartData.push(row);
        
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return chartData;
    } catch (error) {
      logger.error('Error in getCompanyComparison:', error);
      throw error;
    }
  }

  async getMarketShare() {
    try {
      // Get current month date range
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      // Get all active companies with their parcel counts for current month
      const companies = await Company.findAll({
        where: { status: 'active' },
        attributes: [
          'id', 
          'name', 
          'code',
          [sequelize.fn('COUNT', sequelize.col('companyParcels.id')), 'parcel_count']
        ],
        include: [{
          model: Parcel,
          as: 'companyParcels',
          where: {
            created_at: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          },
          attributes: [],
          required: false
        }],
        group: ['Company.id'],
        order: [[sequelize.literal('parcel_count'), 'DESC']],
        subQuery: false,
        raw: true
      });

      // Filter companies with parcels and calculate total
      const companiesWithParcels = companies
        .filter(c => parseInt(c.parcel_count) > 0)
        .map(c => ({
          ...c,
          parcel_count: parseInt(c.parcel_count)
        }));

      if (!companiesWithParcels.length) {
        return [];
      }

      const totalParcels = companiesWithParcels.reduce((sum, c) => sum + c.parcel_count, 0);

      // Calculate market share percentages
      const colors = [
        "hsl(220,70%,18%)",   // Dark blue
        "hsl(38,95%,52%)",    // Orange
        "hsl(142,71%,38%)",   // Green
        "hsl(220,15%,70%)",   // Light gray
        "hsl(0,70%,50%)",     // Red
        "hsl(280,70%,50%)",   // Purple
        "hsl(180,70%,40%)",   // Teal
        "hsl(60,70%,50%)",    // Yellow
        "hsl(300,70%,40%)",   // Pink
        "hsl(120,70%,30%)"    // Dark green
      ];

      // If we have more than 5 companies, group smaller ones as "Others"
      if (companiesWithParcels.length > 5) {
        const top5 = companiesWithParcels.slice(0, 5);
        const others = companiesWithParcels.slice(5);
        
        const marketShare = top5.map((company, index) => {
          const percentage = Math.round((company.parcel_count / totalParcels) * 100);
          return {
            name: company.name,
            value: percentage,
            color: colors[index % colors.length],
            companyId: company.id,
            companyCode: company.code
          };
        });

        // Calculate others percentage
        const othersTotal = others.reduce((sum, c) => sum + c.parcel_count, 0);
        const othersPercentage = Math.round((othersTotal / totalParcels) * 100);
        
        if (othersPercentage > 0) {
          marketShare.push({
            name: "Others",
            value: othersPercentage,
            color: "hsl(220,15%,70%)",
            companyId: null,
            companyCode: null
          });
        }

        return marketShare;
      } else {
        // Return all companies if 5 or fewer
        return companiesWithParcels.map((company, index) => {
          const percentage = Math.round((company.parcel_count / totalParcels) * 100);
          return {
            name: company.name,
            value: percentage,
            color: colors[index % colors.length],
            companyId: company.id,
            companyCode: company.code
          };
        });
      }
    } catch (error) {
      logger.error('Error in getMarketShare:', error);
      throw error;
    }
  }

  async getRevenueTrend(limit = 12) {
    try {
      const revenueData = await Parcel.findAll({
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'parcel_count'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
        ],
        where: {
          status: 'delivered',
          amount: {
            [Op.ne]: null
          }
        },
        group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'ASC']],
        limit: limit,
        raw: true
      });

      return revenueData.map(item => ({
        month: item.month,
        parcels: parseInt(item.parcel_count),
        revenue: parseFloat(item.total_amount || 0)
      }));
    } catch (error) {
      logger.error('Error in getRevenueTrend:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();