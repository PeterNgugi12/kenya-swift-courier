const { User, Branch } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const AppError = require('../utils/appError.util');
const logger = require('../utils/logger.util');
const { HTTP_STATUS, ROLES } = require('../config/constants');
const bcrypt = require('bcrypt');

class CompanyBranchOperatorService {
  // Get all branch operators for a company
  async getAllOperators(companyId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const { branch_id, status, search } = filters;

      const where = { 
        company_id: companyId,
        role: ROLES.BRANCH_OPERATOR
      };
      
      if (branch_id) where.branch_id = branch_id;
      if (status === 'active') where.is_active = true;
      if (status === 'inactive') where.is_active = false;
      
      if (search) {
        where[Op.or] = [
          { full_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows } = await User.findAndCountAll({
        where,
        include: [{
          model: Branch,
          as: 'userBranch',
          attributes: ['id', 'name', 'code', 'town']
        }],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']],
        attributes: { exclude: ['password'] }
      });

      const operators = rows.map(op => ({
        id: op.id,
        full_name: op.full_name,
        email: op.email,
        phone: op.phone,
        role: op.role,
        branch_id: op.branch_id,
        branch_name: op.userBranch?.name,
        branch_code: op.userBranch?.code,
        is_active: op.is_active,
        last_login: op.last_login,
        created_at: op.created_at
      }));

      return {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: operators
      };
    } catch (error) {
      logger.error(`Error in getAllOperators: ${error.message}`);
      throw error;
    }
  }

  // Get operator by ID
  async getOperatorById(operatorId, companyId) {
    try {
      const operator = await User.findOne({
        where: { 
          id: operatorId,
          company_id: companyId,
          role: ROLES.BRANCH_OPERATOR
        },
        include: [{
          model: Branch,
          as: 'userBranch',
          attributes: ['id', 'name', 'code', 'town']
        }],
        attributes: { exclude: ['password'] }
      });

      if (!operator) {
        throw new AppError('Operator not found', HTTP_STATUS.NOT_FOUND);
      }

      return operator;
    } catch (error) {
      logger.error(`Error in getOperatorById: ${error.message}`);
      throw error;
    }
  }

  // Create new branch operator
  async createOperator(companyId, data, createdBy) {
    const transaction = await sequelize.transaction();

    try {
      const { full_name, email, phone, password, branch_id } = data;

      // Check if email already exists
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase().trim() }
      });

      if (existingUser) {
        throw new AppError('Email already exists', HTTP_STATUS.CONFLICT);
      }

      // Check if branch exists and belongs to company
      const branch = await Branch.findOne({
        where: { 
          id: branch_id,
          company_id: companyId
        }
      });

      if (!branch) {
        throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create operator
      const operator = await User.create({
        full_name,
        email: email.toLowerCase().trim(),
        phone,
        password: hashedPassword,
        role: ROLES.BRANCH_OPERATOR,
        company_id: companyId,
        branch_id,
        is_active: true
      }, { transaction });

      await transaction.commit();

      logger.info(`Branch operator created: ${email} for company ${companyId} by user ${createdBy}`);

      const operatorResponse = operator.toJSON();
      delete operatorResponse.password;

      return operatorResponse;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in createOperator: ${error.message}`);
      throw error;
    }
  }

  // Update operator
  async updateOperator(operatorId, companyId, data) {
    try {
      const operator = await User.findOne({
        where: { 
          id: operatorId,
          company_id: companyId,
          role: ROLES.BRANCH_OPERATOR
        }
      });

      if (!operator) {
        throw new AppError('Operator not found', HTTP_STATUS.NOT_FOUND);
      }

      // If email is being updated, check if it's already taken
      if (data.email && data.email.toLowerCase().trim() !== operator.email) {
        const existingUser = await User.findOne({
          where: { 
            email: data.email.toLowerCase().trim(),
            id: { [Op.ne]: operatorId }
          }
        });

        if (existingUser) {
          throw new AppError('Email already in use', HTTP_STATUS.CONFLICT);
        }
      }

      // If branch is being changed, verify it exists
      if (data.branch_id) {
        const branch = await Branch.findOne({
          where: { 
            id: data.branch_id,
            company_id: companyId
          }
        });

        if (!branch) {
          throw new AppError('Branch not found', HTTP_STATUS.NOT_FOUND);
        }
      }

      const allowedUpdates = {};
      if (data.full_name) allowedUpdates.full_name = data.full_name;
      if (data.email) allowedUpdates.email = data.email.toLowerCase().trim();
      if (data.phone) allowedUpdates.phone = data.phone;
      if (data.branch_id) allowedUpdates.branch_id = data.branch_id;

      await operator.update(allowedUpdates);

      logger.info(`Operator updated: ${operator.email}`);

      const operatorResponse = operator.toJSON();
      delete operatorResponse.password;

      return operatorResponse;
    } catch (error) {
      logger.error(`Error in updateOperator: ${error.message}`);
      throw error;
    }
  }

  // Update operator status (suspend/activate)
  async updateOperatorStatus(operatorId, companyId, isActive) {
    try {
      const operator = await User.findOne({
        where: { 
          id: operatorId,
          company_id: companyId,
          role: ROLES.BRANCH_OPERATOR
        }
      });

      if (!operator) {
        throw new AppError('Operator not found', HTTP_STATUS.NOT_FOUND);
      }

      await operator.update({ is_active: isActive });

      logger.info(`Operator ${operator.email} status updated to ${isActive ? 'active' : 'inactive'}`);

      const operatorResponse = operator.toJSON();
      delete operatorResponse.password;

      return operatorResponse;
    } catch (error) {
      logger.error(`Error in updateOperatorStatus: ${error.message}`);
      throw error;
    }
  }

  // Delete operator
  async deleteOperator(operatorId, companyId) {
    try {
      const operator = await User.findOne({
        where: { 
          id: operatorId,
          company_id: companyId,
          role: ROLES.BRANCH_OPERATOR
        }
      });

      if (!operator) {
        throw new AppError('Operator not found', HTTP_STATUS.NOT_FOUND);
      }

      // Soft delete by deactivating
      await operator.update({ 
        is_active: false,
        email: `deleted_${Date.now()}_${operator.email}` // Prevent email reuse
      });

      logger.info(`Operator ${operator.email} deleted`);

      return { success: true };
    } catch (error) {
      logger.error(`Error in deleteOperator: ${error.message}`);
      throw error;
    }
  }

  // Reset operator password
  async resetPassword(operatorId, companyId, newPassword) {
    try {
      const operator = await User.findOne({
        where: { 
          id: operatorId,
          company_id: companyId,
          role: ROLES.BRANCH_OPERATOR
        }
      });

      if (!operator) {
        throw new AppError('Operator not found', HTTP_STATUS.NOT_FOUND);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      await operator.update({ 
        password: hashedPassword,
        login_attempts: 0,
        lock_until: null
      });

      logger.info(`Password reset for operator ${operator.email}`);

      return { success: true };
    } catch (error) {
      logger.error(`Error in resetPassword: ${error.message}`);
      throw error;
    }
  }

  // Get operator statistics
  async getOperatorStats(companyId) {
    try {
      const stats = await User.findAll({
        where: { 
          company_id: companyId,
          role: ROLES.BRANCH_OPERATOR
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN is_active = true THEN 1 END")
          ), 'active'],
          [sequelize.fn('COUNT', 
            sequelize.literal("CASE WHEN is_active = false THEN 1 END")
          ), 'inactive']
        ],
        raw: true
      });

      return {
        total: parseInt(stats[0]?.total) || 0,
        active: parseInt(stats[0]?.active) || 0,
        inactive: parseInt(stats[0]?.inactive) || 0
      };
    } catch (error) {
      logger.error(`Error in getOperatorStats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CompanyBranchOperatorService();