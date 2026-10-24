const { sequelize } = require('../config/database');
const { Parcel, SMSLog, Branch } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger.util');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

class CompanyReportsService {
  // Get summary statistics
  async getSummary(companyId, dateRange = {}) {
    try {
      const { start_date, end_date } = dateRange;

      // Set default date range to current month if not provided
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const startOfLastMonth = new Date();
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
      startOfLastMonth.setDate(1);
      startOfLastMonth.setHours(0, 0, 0, 0);

      const endOfLastMonth = new Date();
      endOfLastMonth.setDate(0);
      endOfLastMonth.setHours(23, 59, 59, 999);

      // Current month stats
      const currentMonthStats = await Parcel.findAll({
        where: {
          company_id: companyId,
          created_at: {
            [Op.between]: [start_date ? new Date(start_date) : startOfMonth, 
                          end_date ? new Date(end_date) : endOfMonth]
          }
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'parcels'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'revenue']
        ],
        raw: true
      });

      // Last month stats for growth calculation
      const lastMonthStats = await Parcel.findAll({
        where: {
          company_id: companyId,
          created_at: {
            [Op.between]: [startOfLastMonth, endOfLastMonth]
          }
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'parcels']
        ],
        raw: true
      });

      // SMS stats
      const smsStats = await SMSLog.findAll({
        where: {
          company_id: companyId,
          created_at: {
            [Op.between]: [start_date ? new Date(start_date) : startOfMonth, 
                          end_date ? new Date(end_date) : endOfMonth]
          }
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('cost')), 'cost']
        ],
        raw: true
      });

      // Calculate growth
      const currentParcels = parseInt(currentMonthStats[0]?.parcels) || 0;
      const lastParcels = parseInt(lastMonthStats[0]?.parcels) || 0;
      const growth = lastParcels > 0 
        ? ((currentParcels - lastParcels) / lastParcels) * 100 
        : 0;

      return {
        current_month: {
          parcels: currentParcels,
          revenue: parseFloat(currentMonthStats[0]?.revenue) || 0,
          sms_sent: parseInt(smsStats[0]?.count) || 0,
          sms_cost: parseFloat(smsStats[0]?.cost) || 0,
          growth
        },
        summary: {
          total_parcels: currentParcels,
          total_revenue: parseFloat(currentMonthStats[0]?.revenue) || 0,
          total_sms: parseInt(smsStats[0]?.count) || 0
        }
      };
    } catch (error) {
      logger.error(`Error in getSummary: ${error.message}`);
      throw error;
    }
  }

  // Get monthly breakdown
  async getMonthlyBreakdown(companyId, dateRange = {}) {
    try {
      const { start_date, end_date } = dateRange;

      const where = { company_id: companyId };
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at[Op.gte] = new Date(start_date);
        if (end_date) where.created_at[Op.lte] = new Date(end_date);
      }

      const monthlyData = await Parcel.findAll({
        where,
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'parcels'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'revenue']
        ],
        group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      // Get SMS counts per month
      const smsMonthly = await SMSLog.findAll({
        where,
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('cost')), 'cost']
        ],
        group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at'))],
        raw: true
      });

      // Combine data
      const result = monthlyData.map(item => {
        const smsItem = smsMonthly.find(s => 
          new Date(s.month).getTime() === new Date(item.month).getTime()
        );
        return {
          month: item.month,
          parcels: parseInt(item.parcels) || 0,
          revenue: parseFloat(item.revenue) || 0,
          sms_count: parseInt(smsItem?.count) || 0,
          sms_cost: parseFloat(smsItem?.cost) || 0
        };
      });

      return result;
    } catch (error) {
      logger.error(`Error in getMonthlyBreakdown: ${error.message}`);
      throw error;
    }
  }

  // Export report as PDF
  async generatePDF(companyId, companyName, dateRange = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Get data
        const summary = await this.getSummary(companyId, dateRange);
        const monthly = await this.getMonthlyBreakdown(companyId, dateRange);

        // Header
        doc.fontSize(20).text('Company Performance Report', { align: 'center' });
        doc.fontSize(12).text(companyName, { align: 'center' });
        doc.moveDown();
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'right' });
        doc.moveDown();

        // Summary section
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(12).text(`Parcels This Period: ${summary.current_month.parcels}`);
        doc.text(`Revenue: KES ${summary.current_month.revenue.toLocaleString()}`);
        doc.text(`SMS Sent: ${summary.current_month.sms_sent}`);
        doc.text(`Growth Rate: ${summary.current_month.growth.toFixed(1)}%`);
        doc.moveDown();

        // Monthly breakdown
        doc.fontSize(16).text('Monthly Breakdown', { underline: true });
        doc.moveDown(0.5);

        // Table header
        const startX = 50;
        let y = doc.y;
        
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Month', startX, y);
        doc.text('Parcels', startX + 100, y);
        doc.text('Revenue', startX + 200, y);
        doc.text('SMS', startX + 300, y);
        
        y += 20;
        doc.font('Helvetica');

        // Table rows
        monthly.forEach(item => {
          const month = new Date(item.month).toLocaleDateString('en-KE', { 
            month: 'short', 
            year: 'numeric' 
          });
          doc.text(month, startX, y);
          doc.text(item.parcels.toString(), startX + 100, y);
          doc.text(`KES ${item.revenue.toLocaleString()}`, startX + 200, y);
          doc.text(item.sms_count.toString(), startX + 300, y);
          y += 20;
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate CSV report
  async generateCSV(companyId, dateRange = {}) {
    try {
      const monthly = await this.getMonthlyBreakdown(companyId, dateRange);
      
      const csvRows = [];
      // Headers
      csvRows.push(['Month', 'Parcels', 'Revenue (KES)', 'SMS Count', 'SMS Cost (KES)']);
      
      // Data rows
      monthly.forEach(item => {
        const month = new Date(item.month).toLocaleDateString('en-KE', { 
          month: 'short', 
          year: 'numeric' 
        });
        csvRows.push([
          month,
          item.parcels,
          item.revenue,
          item.sms_count,
          item.sms_cost
        ]);
      });

      return csvRows.map(row => row.join(',')).join('\n');
    } catch (error) {
      logger.error(`Error in generateCSV: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CompanyReportsService();