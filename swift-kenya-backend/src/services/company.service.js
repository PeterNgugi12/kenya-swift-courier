const { Company, Wallet, User, Branch, Vehicle, Driver, Parcel, SMSLog } = require('../models'); 
const { sequelize } = require('../config/database');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS, ROLES } = require('../config/constants');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

class CompanyService {
  async createCompany(data, adminUserId) {
    if (!data) {
      throw new AppError('No data provided', HTTP_STATUS.BAD_REQUEST);
    }

    const transaction = await sequelize.transaction();

    try {
      const name = data.name?.trim();
      const code = data.code?.trim()?.toUpperCase();
      const logo_url = data.logo_url || null;
      const phone = data.phone?.trim();
      const email = data.email?.trim()?.toLowerCase();
      const address = data.address?.trim();
      const admin_name = data.admin_name?.trim();
      const admin_email = data.admin_email?.trim()?.toLowerCase();
      const admin_phone = data.admin_phone?.trim();
      const admin_password = data.admin_password;

      if (!name) {
        throw new AppError('Company name is required and cannot be empty', HTTP_STATUS.BAD_REQUEST);
      }
      
      if (!code) {
        throw new AppError('Company code is required and cannot be empty', HTTP_STATUS.BAD_REQUEST);
      }
      
      if (!admin_name) {
        throw new AppError('Admin name is required and cannot be empty', HTTP_STATUS.BAD_REQUEST);
      }
      
      if (!admin_email) {
        throw new AppError('Admin email is required and cannot be empty', HTTP_STATUS.BAD_REQUEST);
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(admin_email)) {
        throw new AppError('Invalid admin email format', HTTP_STATUS.BAD_REQUEST);
      }
      
      if (!admin_phone) {
        throw new AppError('Admin phone is required and cannot be empty', HTTP_STATUS.BAD_REQUEST);
      }
      
      if (!admin_password) {
        throw new AppError('Password is required and cannot be empty', HTTP_STATUS.BAD_REQUEST);
      }
      
      if (admin_password.length < 8) {
        throw new AppError('Password must be at least 8 characters long', HTTP_STATUS.BAD_REQUEST);
      }

      const existingCompany = await Company.findOne({ where: { code } });
      if (existingCompany) {
        throw new AppError('Company code already exists', HTTP_STATUS.CONFLICT);
      }

      const existingUser = await User.findOne({ where: { email: admin_email } });
      if (existingUser) {
        throw new AppError('Admin email already exists', HTTP_STATUS.CONFLICT);
      }

      const companyData = {
        name,
        code,
        logo_url,
        status: 'active'
      };

      if (phone) companyData.phone = phone;
      
      if (email) {
        if (!emailRegex.test(email)) {
          throw new AppError('Invalid company email format', HTTP_STATUS.BAD_REQUEST);
        }
        companyData.email = email;
      }
      
      if (address) companyData.address = address;

      const company = await Company.create(companyData, { transaction });

      await Wallet.create({
        company_id: company.id,
        balance: 0,
        total_credits: 0,
        total_deductions: 0,
        status: 'active'
      }, { transaction });

      const hashedPassword = await bcrypt.hash(admin_password, 12);

      await User.create({
        full_name: admin_name,
        email: admin_email,
        password: hashedPassword,
        role: ROLES.COMPANY_ADMIN,
        is_active: true,
        company_id: company.id
      }, { transaction });

      await transaction.commit();
      logger.info(`Company created: ${name} by Super Admin ${adminUserId}`);
      return company;

    } catch (error) {
      await transaction.rollback();
      logger.error(`Company creation failed: ${error.message}`);
      throw error;
    }
  }

 async getAllCompanies(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const { status, search } = filters;

      const where = {};
      if (status) where.status = status;
      
      if (search) {
        where[Op.or] = [  // Now Op is defined
          { name: { [Op.iLike]: `%${search}%` } },
          { code: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Get companies with counts using separate queries for better performance
      const { count, rows } = await Company.findAndCountAll({
        where,
        include: [
          {
            model: Wallet,
            as: 'companyWallet',
            attributes: ['balance', 'total_credits', 'total_deductions', 'status'],
            required: false
          }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']],
        distinct: true
      });

      // For each company, get counts of related data
      const companiesWithStats = await Promise.all(
        rows.map(async (company) => {
          const companyJson = company.toJSON();
          
          // Get branches count
          const branchesCount = await Branch.count({
            where: { company_id: company.id }
          });
          
          // Get vehicles count
          const vehiclesCount = await Vehicle.count({
            where: { company_id: company.id }
          });
          
          // Get drivers count
          const driversCount = await Driver.count({
            where: { company_id: company.id }
          });
          
          // Get parcels count for current month
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const parcelsThisMonth = await Parcel.count({
            where: {
              company_id: company.id,
              created_at: {
                [Op.gte]: startOfMonth  // Now Op.gte works
              }
            }
          });
          
          // Get revenue for current month
          const revenueThisMonth = await Parcel.sum('amount', {
            where: {
              company_id: company.id,
              created_at: {
                [Op.gte]: startOfMonth  // Now Op.gte works
              }
            }
          });

          // Format revenue properly
          const formattedRevenue = revenueThisMonth 
            ? `KES ${Number(revenueThisMonth).toLocaleString('en-KE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}`
            : 'KES 0';

          return {
            id: companyJson.id,
            name: companyJson.name,
            code: companyJson.code,
            logo_url: companyJson.logo_url,
            status: companyJson.status,
            phone: companyJson.phone,
            email: companyJson.email,
            address: companyJson.address,
            created_at: companyJson.created_at,
            branches_count: branchesCount,
            vehicles_count: vehiclesCount,
            drivers_count: driversCount,
            parcels_this_month: parcelsThisMonth || 0,
            revenue_this_month: formattedRevenue,
            revenue_numeric: revenueThisMonth || 0,
            wallet: companyJson.wallet ? {
              balance: parseFloat(companyJson.wallet.balance) || 0,
              total_credits: parseFloat(companyJson.wallet.total_credits) || 0,
              total_deductions: parseFloat(companyJson.wallet.total_deductions) || 0,
              status: companyJson.wallet.status
            } : null
          };
        })
      );

      logger.debug(`Retrieved ${companiesWithStats.length} companies`);

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: companiesWithStats
      };
    } catch (error) {
      logger.error(`Error in getAllCompanies: ${error.message}`);
      throw error;
    }
  }

  async getCompanyById(companyId) {
    try {
      const company = await Company.findByPk(companyId, {
        include: [
          {
            model: Wallet,
            as: 'wallet'
          },
          {
            model: Branch,
            as: 'branches',
            required: false,
            limit: 10
          },
          {
            model: Vehicle,
            as: 'vehicles',
            required: false,
            limit: 10
          },
          {
            model: Driver,
            as: 'drivers',
            required: false,
            limit: 10
          }
        ]
      });

      if (!company) {
        throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
      }

      // Get additional stats
      const parcelsCount = await Parcel.count({
        where: { company_id: companyId }
      });

      const smsCount = await SMSLog.count({
        where: { company_id: companyId }
      });

      const companyJson = company.toJSON();
      
      return {
        ...companyJson,
        total_parcels: parcelsCount,
        total_sms: smsCount,
        wallet: companyJson.wallet ? {
          ...companyJson.wallet,
          balance: parseFloat(companyJson.wallet.balance) || 0,
          total_credits: parseFloat(companyJson.wallet.total_credits) || 0,
          total_deductions: parseFloat(companyJson.wallet.total_deductions) || 0
        } : null
      };
    } catch (error) {
      logger.error(`Error in getCompanyById: ${error.message}`);
      throw error;
    }
  }

  async updateCompany(companyId, data) {
    try {
      const company = await Company.findByPk(companyId);
      if (!company) {
        throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
      }

      // Only update fields that are provided
      const updateData = {};
      if (data.name) updateData.name = data.name.trim();
      if (data.phone) updateData.phone = data.phone.trim();
      if (data.email) updateData.email = data.email.trim().toLowerCase();
      if (data.address) updateData.address = data.address.trim();
      if (data.logo_url) updateData.logo_url = data.logo_url;

      await company.update(updateData);
      logger.info(`Company updated: ${company.name}`);

      return company;
    } catch (error) {
      logger.error(`Error in updateCompany: ${error.message}`);
      throw error;
    }
  }

  async updateCompanyStatus(companyId, status) {
    try {
      const company = await Company.findByPk(companyId);
      if (!company) {
        throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
      }

      await company.update({ status });
      
      // Also update wallet status
      await Wallet.update(
        { status: status === 'active' ? 'active' : 'frozen' },
        { where: { company_id: companyId } }
      );

      logger.info(`Company ${company.name} status updated to ${status}`);

      return company;
    } catch (error) {
      logger.error(`Error in updateCompanyStatus: ${error.message}`);
      throw error;
    }
  }

  async getCompanyStats(companyId) {
    try {
      const company = await Company.findByPk(companyId);
      if (!company) {
        throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
      }

      // Get parcel statistics
      const parcels = await Parcel.findAll({
        where: { company_id: companyId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total_revenue'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'delivered' THEN 1 END")
          ), 'delivered'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'in_transit' THEN 1 END")
          ), 'in_transit'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")
          ), 'pending']
        ],
        raw: true
      });

      // Get vehicle statistics
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

      // Get driver statistics
      const drivers = await Driver.findAll({
        where: { company_id: companyId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
          ), 'active'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'off_duty' THEN 1 END")
          ), 'off_duty']
        ],
        raw: true
      });

      // Get SMS statistics
      const sms = await SMSLog.findAll({
        where: { company_id: companyId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'sent'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'delivered' THEN 1 END")
          ), 'delivered'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN status = 'failed' THEN 1 END")
          ), 'failed']
        ],
        raw: true
      });

      return {
        parcels: parcels[0] || { total: 0, total_revenue: 0, delivered: 0, in_transit: 0, pending: 0 },
        vehicles: vehicles[0] || { total: 0, active: 0, maintenance: 0 },
        drivers: drivers[0] || { total: 0, active: 0, off_duty: 0 },
        sms: sms[0] || { sent: 0, delivered: 0, failed: 0 }
      };
    } catch (error) {
      logger.error(`Error in getCompanyStats: ${error.message}`);
      throw error;
    }
  }

  // Helper method to validate email
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = new CompanyService();