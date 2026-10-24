const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');
const { ROLES, SECURITY } = require('../config/constants');
const logger = require('../utils/logger.util');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Full name cannot be empty'
      },
      len: {
        args: [2, 100],
        msg: 'Full name must be between 2 and 100 characters'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      msg: 'Email already exists'
    },
    validate: {
      isEmail: {
        msg: 'Please provide a valid email address'
      },
      notEmpty: {
        msg: 'Email cannot be empty'
      }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Password cannot be empty'
      },
      len: {
        args: [6, 100],
        msg: 'Password must be between 6 and 100 characters'
      }
    }
  },
  notification_preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      email_notifications: true,
      sms_notifications: true,
      low_balance_alerts: true
    },
    allowNull: true
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'companies',
      key: 'id'
    }
  },
  // Add this field to your User model
branch_id: {
  type: DataTypes.UUID,
  allowNull: true,
  references: {
    model: 'branches',
    key: 'id'
  }
},
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isValidPhone(value) {
        if (value && value.trim() === '') {
          throw new Error('Phone cannot be empty string');
        }
      }
    }
  },
  role: {
    type: DataTypes.ENUM(Object.values(ROLES)),
    allowNull: false,
    defaultValue: ROLES.BRANCH_OPERATOR
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lock_until: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      // Only hash if password exists and is not already a bcrypt hash
      if (user.password && !user.password.startsWith('$2b$')) {
        user.password = await bcrypt.hash(user.password, SECURITY.BCRYPT_ROUNDS);
        logger.info(`Password hashed for new user: ${user.email}`);
      }
    },
    beforeUpdate: async (user) => {
      // Only hash if password was changed and is not already a bcrypt hash
      if (user.changed('password') && user.password && !user.password.startsWith('$2b$')) {
        user.password = await bcrypt.hash(user.password, SECURITY.BCRYPT_ROUNDS);
        logger.info(`Password updated and hashed for user: ${user.email}`);
      } else if (user.changed('password')) {
        logger.info(`Password updated for user: ${user.email} (already hashed)`);
      }
    },
    afterCreate: (user) => {
      logger.info(`User created successfully: ${user.email} with role ${user.role}`);
    }
  }
});

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.incrementLoginAttempts = async function() {
  this.login_attempts += 1;
  
  if (this.login_attempts >= SECURITY.MAX_LOGIN_ATTEMPTS) {
    this.lock_until = new Date(Date.now() + SECURITY.LOCK_TIME);
    logger.warn(`Account locked for user: ${this.email} due to too many failed attempts`);
  }
  
  await this.save();
  return this;
};

User.prototype.resetLoginAttempts = async function() {
  this.login_attempts = 0;
  this.lock_until = null;
  this.last_login = new Date();
  await this.save();
  logger.info(`Login attempts reset for user: ${this.email}`);
};

User.prototype.isLocked = function() {
  return this.lock_until && this.lock_until > new Date();
};

// Static methods
User.checkSuperAdminExists = async function() {
  const count = await this.count({
    where: { role: ROLES.SUPER_ADMIN }
  });
  return count > 0;
};

User.findByEmail = async function(email) {
  return this.findOne({
    where: { email: email.toLowerCase().trim() }
  });
};

// Class method for safe user creation
User.createSuperAdminSafely = async function(userData) {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if super admin exists within transaction
    const superAdminExists = await this.findOne({
      where: { role: ROLES.SUPER_ADMIN },
      transaction
    });

    if (superAdminExists) {
      throw new Error('Super Admin already exists');
    }

    // Create super admin
    const superAdmin = await this.create({
      ...userData,
      role: ROLES.SUPER_ADMIN,
      email: userData.email.toLowerCase().trim()
    }, { transaction });

    await transaction.commit();
    
    // Remove password from response
    const userResponse = superAdmin.toJSON();
    delete userResponse.password;
    
    return userResponse;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Ensure only one super admin exists at database level
User.addHook('beforeCreate', 'checkSuperAdminCount', async (user, options) => {
  if (user.role === ROLES.SUPER_ADMIN) {
    const count = await User.count({
      where: { role: ROLES.SUPER_ADMIN }
    });
    
    if (count > 0) {
      throw new Error('Only one SUPER_ADMIN allowed in the system');
    }
  }
});

module.exports = User;