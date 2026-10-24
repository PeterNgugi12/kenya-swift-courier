const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Parcel = sequelize.define('Parcel', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tracking_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  sender_name: {
    type: DataTypes.STRING(100)
  },
  sender_phone: {
    type: DataTypes.STRING(20)
  },
  receiver_name: {
    type: DataTypes.STRING(100)
  },
  receiver_phone: {
    type: DataTypes.STRING(20)
  },
  // ✅ ADD DESCRIPTION FIELD HERE
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description'
  },
  origin_branch: {
    type: DataTypes.UUID
  },
  destination_branch: {
    type: DataTypes.UUID
  },
  weight: {
    type: DataTypes.DECIMAL(10, 2)
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2)
  },
  payment_method: {
    type: DataTypes.STRING(50),
    defaultValue: 'Cash'
  },
  payment_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    validate: {
      isIn: [['paid', 'pending', 'destination']]
    }
  },
  trip_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  parcel_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'booked', 'picked_up', 'in_transit', 'arrived', 'delivered', 'cancelled']]
    }
  },
  sms_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'sms_sent',
    allowNull: false
  },
  sms_sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sms_sent_at'
  },
  released_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  released_by: {
    type: DataTypes.UUID,
    allowNull: true
  },
  collector_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  collector_id_number: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  collector_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  collector_relationship: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'parcels',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (parcel) => {
      if (!parcel.tracking_number) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        parcel.tracking_number = `TRK-${year}${month}${day}-${random}`;
      }
    }
  }
});

Parcel.associate = function(models) {
  Parcel.belongsTo(models.Branch, {
    foreignKey: 'origin_branch',
    as: 'originBranch'
  });

  Parcel.belongsTo(models.Branch, {
    foreignKey: 'destination_branch',
    as: 'destinationBranch'
  });

  Parcel.belongsTo(models.Trip, {
    foreignKey: 'trip_id',
    as: 'trip'
  });

  Parcel.belongsTo(models.Company, {
    foreignKey: 'company_id',
    as: 'company'
  });

  Parcel.belongsTo(models.User, {
    foreignKey: 'released_by',
    as: 'releasedBy'
  });

  Parcel.hasMany(models.SMSLog, {
    foreignKey: 'parcel_id',
    as: 'smsLogs'
  });
};

module.exports = Parcel;