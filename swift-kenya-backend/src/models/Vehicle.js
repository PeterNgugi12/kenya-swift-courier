const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Vehicle = sequelize.define('Vehicle', {
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
  plate_number: {  // Make sure this is the column name
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [3, 20]
    }
  },
  type: {
    type: DataTypes.ENUM('Bus', 'Matatu', 'Lorry', 'Van', 'Pickup', 'Motorcycle'),
    allowNull: false
  },
  route: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 1000
    }
  },
  capacity_unit: {
    type: DataTypes.STRING(20),
    defaultValue: 'units',
    allowNull: true
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'drivers',
      key: 'id'
    }
  },
  driver_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
// models/Vehicle.js - updated status field
status: {
  type: DataTypes.STRING(20),
  defaultValue: 'active',
  validate: {
    isIn: [['active', 'in_transit', 'maintenance', 'inactive', 'sold', 'assigned']]
  }
},
  total_trips: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_parcels: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_maintenance: {
    type: DataTypes.DATE,
    allowNull: true
  },
  next_maintenance: {
    type: DataTypes.DATE,
    allowNull: true
  },
  maintenance_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sold_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sold_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'vehicles',
  hooks: {
    beforeCreate: (vehicle) => {
      if (vehicle.plate_number) {
        vehicle.plate_number = vehicle.plate_number.toUpperCase();
      }
    },
    beforeUpdate: (vehicle) => {
      if (vehicle.changed('plate_number')) {
        vehicle.plate_number = vehicle.plate_number.toUpperCase();
      }
    }
  }
});

module.exports = Vehicle;