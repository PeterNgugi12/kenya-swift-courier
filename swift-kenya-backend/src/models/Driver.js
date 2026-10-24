const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Driver = sequelize.define('Driver', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'companies',
      key: 'id'
    }
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'branches',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  license_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  license_expiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  vehicle_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'vehicles',
      key: 'id'
    }
  },
  vehicle_plate: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  route: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
 status: {
  type: DataTypes.STRING(20),
  defaultValue: 'active',
  validate: {
    isIn: [['active', 'inactive', 'on_leave', 'assigned']]
  }
},
  total_trips: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 4.0,
    validate: {
      min: 0,
      max: 5
    }
  },
  hire_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  leave_start: {
    type: DataTypes.DATE,
    allowNull: true
  },
  leave_end: {
    type: DataTypes.DATE,
    allowNull: true
  },
  leave_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'drivers',
  hooks: {
    beforeUpdate: async (driver) => {
      // If status changes to on_leave, set leave_start
      if (driver.changed('status') && driver.status === 'on_leave' && !driver.leave_start) {
        driver.leave_start = new Date();
      }
      // If status changes from on_leave to active, clear leave dates
      if (driver.changed('status') && driver.status !== 'on_leave') {
        driver.leave_start = null;
        driver.leave_end = null;
        driver.leave_reason = null;
      }
    }
  }
});

module.exports = Driver;