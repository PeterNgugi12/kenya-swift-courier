const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Trip = sequelize.define('Trip', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  trip_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  origin_branch_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  destination_branch_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  vehicle_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  driver_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  driver_phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  vehicle_plate: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  vehicle_type: {
    type: DataTypes.STRING(50)
  },
  departure_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  arrival_time: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.STRING(20), // Changed from ENUM to STRING
    defaultValue: 'scheduled',
    allowNull: false,
    validate: {
      isIn: [['scheduled', 'departed', 'in_transit', 'arrived', 'cancelled']]
    }
  },
  created_by: {
    type: DataTypes.UUID
  }
}, {
  tableName: 'trips',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

Trip.associate = function(models) {
  Trip.belongsTo(models.Vehicle, {
    foreignKey: 'vehicle_id',
    as: 'tripVehicle'
  });

  Trip.belongsTo(models.Driver, {
    foreignKey: 'driver_id',
    as: 'tripDriver'
  });

  Trip.belongsTo(models.Branch, {
    foreignKey: 'origin_branch_id',
    as: 'originBranch'
  });

  Trip.belongsTo(models.Branch, {
    foreignKey: 'destination_branch_id',
    as: 'destinationBranch'
  });

  Trip.hasMany(models.Parcel, {
    foreignKey: 'trip_id',
    as: 'parcels'
  });

  Trip.belongsTo(models.Company, {
    foreignKey: 'company_id',
    as: 'company'
  });
};

module.exports = Trip;