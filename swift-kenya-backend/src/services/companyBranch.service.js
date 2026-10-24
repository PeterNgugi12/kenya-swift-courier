const { Branch, User, Parcel } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS, ROLES } = require('../config/constants');
const bcrypt = require('bcrypt');

class CompanyBranchService {
  // Get all branches for a company
  async getAllBranches(companyId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const { status, search } = filters;

      const where = { company_id: companyId };
      if (status && status !== 'all') where.status = status;
      
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { code: { [Op.iLike]: `%${search}%` } },
          { town: { [Op.iLike]: `%${search}%` } },
          { manager_name: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows } = await Branch.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']]
      });

      // Get additional stats for each branch
      const branchesWithStats = await Promise.all(
        rows.map(async (branch) => {
          const branchJson = branch.toJSON();
          
          // Count operators (users with role BRANCH_OPERATOR for this branch)
          const operatorCount = await User.count({
            where: { 
              branch_id: branch.id,
              role: ROLES.BRANCH_OPERATOR
            }
          });

          // Count parcels for this branch
          const parcelCount = await Parcel.count({
            where: {
              [Op.or]: [
                { origin_branch: branch.id },
                { destination_branch: branch.id }
              ],
              created_at: {
                [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          });

          // Calculate revenue for this branch
          const revenue = await Parcel.sum('amount', {
            where: {
              destination_branch: branch.id,
              status: 'delivered',
              created_at: {
                [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          });

          return {
            ...branchJson,
            operator_count: operatorCount,
            parcel_count: parcelCount || 0,
            revenue: revenue || 0
          };
        })
      );

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: branchesWithStats
      };
    } catch (error) {
      logger.error(`Error in getAllBranches: ${error.message}`);
      throw error;
    }
  }

  // Get branch by ID
  async getBranchById(branchId, companyId) {
    try {
      const branch = await Branch.findOne({
        where: { 
          id: branchId,
          company_id: companyId
        }
      });

      if (!branch) {
        throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
      }

      // Get operators for this branch
      const operators = await User.findAll({
        where: { 
          branch_id: branch.id,
          role: ROLES.BRANCH_OPERATOR
        },
        attributes: ['id', 'full_name', 'email', 'phone', 'is_active']
      });

      // Get recent parcels
      const recentParcels = await Parcel.findAll({
        where: {
          [Op.or]: [
            { origin_branch: branch.id },
            { destination_branch: branch.id }
          ]
        },
        limit: 10,
        order: [['created_at', 'DESC']]
      });

      const branchJson = branch.toJSON();
      
      return {
        ...branchJson,
        operators,
        recent_parcels: recentParcels,
        operator_count: operators.length
      };
    } catch (error) {
      logger.error(`Error in getBranchById: ${error.message}`);
      throw error;
    }
  }

  // Create new branch
  async createBranch(companyId, data, createdBy) {
    const transaction = await sequelize.transaction();

    try {
      const { 
        name, code, town, phone, address,
        manager_name, manager_email, manager_phone, manager_password 
      } = data;

      // Check if branch code already exists in this company
      const existingBranch = await Branch.findOne({
        where: { 
          company_id: companyId,
          code: code.toUpperCase()
        }
      });

      if (existingBranch) {
        throw new AppError('Branch code already exists', HTTP_STATUS.CONFLICT);
      }

      // Create branch
      const branch = await Branch.create({
        company_id: companyId,
        name,
        code: code.toUpperCase(),
        town,
        phone,
        address,
        manager_name,
        manager_email,
        manager_phone,
        status: 'active',
        is_active: true
      }, { transaction });

      // Create branch manager user (as BRANCH_OPERATOR)
      if (manager_email && manager_password) {
        const hashedPassword = await bcrypt.hash(manager_password, 12);
        
        await User.create({
          full_name: manager_name,
          email: manager_email.toLowerCase().trim(),
          password: hashedPassword,
          phone: manager_phone,
          role: ROLES.BRANCH_OPERATOR,
          company_id: companyId,
          branch_id: branch.id,
          is_active: true
        }, { transaction });
      }

      await transaction.commit();

      logger.info(`Branch created: ${name} for company ${companyId}`);

      return branch;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in createBranch: ${error.message}`);
      throw error;
    }
  }

  // Update branch
  async updateBranch(branchId, companyId, data) {
    try {
      const branch = await Branch.findOne({
        where: { 
          id: branchId,
          company_id: companyId
        }
      });

      if (!branch) {
        throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
      }

      const allowedUpdates = {};
      if (data.name) allowedUpdates.name = data.name;
      if (data.town) allowedUpdates.town = data.town;
      if (data.phone) allowedUpdates.phone = data.phone;
      if (data.address) allowedUpdates.address = data.address;
      if (data.manager_name) allowedUpdates.manager_name = data.manager_name;
      if (data.manager_email) allowedUpdates.manager_email = data.manager_email;
      if (data.manager_phone) allowedUpdates.manager_phone = data.manager_phone;

      await branch.update(allowedUpdates);

      logger.info(`Branch updated: ${branch.name}`);

      return branch;
    } catch (error) {
      logger.error(`Error in updateBranch: ${error.message}`);
      throw error;
    }
  }

  // Update branch status
  async updateBranchStatus(branchId, companyId, status) {
    try {
      const branch = await Branch.findOne({
        where: { 
          id: branchId,
          company_id: companyId
        }
      });

      if (!branch) {
        throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
      }

      await branch.update({ 
        status,
        is_active: status === 'active'
      });

      logger.info(`Branch ${branch.name} status updated to ${status}`);

      return branch;
    } catch (error) {
      logger.error(`Error in updateBranchStatus: ${error.message}`);
      throw error;
    }
  }

  // Delete branch (soft delete)
  async deleteBranch(branchId, companyId) {
    try {
      const branch = await Branch.findOne({
        where: { 
          id: branchId,
          company_id: companyId
        }
      });

      if (!branch) {
        throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
      }

      // Check if branch has active operators
      const operatorCount = await User.count({
        where: { 
          branch_id: branch.id,
          role: ROLES.BRANCH_OPERATOR,
          is_active: true
        }
      });

      if (operatorCount > 0) {
        throw new AppError('Cannot delete branch with active operators', HTTP_STATUS.BAD_REQUEST);
      }

      // Soft delete by deactivating
      await branch.update({ 
        status: 'inactive',
        is_active: false 
      });

      logger.info(`Branch deactivated: ${branch.name}`);

      return { success: true };
    } catch (error) {
      logger.error(`Error in deleteBranch: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CompanyBranchService();