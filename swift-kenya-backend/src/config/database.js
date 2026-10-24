const { Sequelize } = require('sequelize');
const logger = require('../utils/logger.util'); // Make sure you create this
require('dotenv').config();

// Parse pool size from env or use defaults
const poolMax = parseInt(process.env.DB_POOL_MAX) || 20;
const poolMin = parseInt(process.env.DB_POOL_MIN) || 5;
const poolAcquire = parseInt(process.env.DB_POOL_ACQUIRE) || 60000;
const poolIdle = parseInt(process.env.DB_POOL_IDLE) || 10000;
const statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT) || 10000;

// Determine SSL settings based on environment and database capability
const getDialectOptions = () => {
  // If SSL is explicitly disabled via env var, don't use it
  if (process.env.DB_SSL === 'false') {
    return {
      connectTimeout: 60000,
      statement_timeout: statementTimeout,
      idle_in_transaction_session_timeout: statementTimeout
    };
  }

  // For production, try SSL but don't require it
  if (process.env.NODE_ENV === 'production') {
    return {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      connectTimeout: 60000,
      statement_timeout: statementTimeout,
      idle_in_transaction_session_timeout: statementTimeout
    };
  }

  // For development, don't use SSL by default
  return {
    connectTimeout: 60000,
    statement_timeout: statementTimeout,
    idle_in_transaction_session_timeout: statementTimeout
  };
};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    dialectOptions: getDialectOptions(),
    logging: (msg, timing) => {
      if (process.env.NODE_ENV === 'development') {
        // Color-coded logging based on query time
        if (timing > 1000) {
          logger.warn(`🐢 SLOW QUERY (${timing}ms): ${msg}`);
        } else if (timing > 100) {
          logger.debug(`⚡ MEDIUM QUERY (${timing}ms): ${msg.substring(0, 200)}...`);
        } else {
          logger.http(`📦 FAST QUERY (${timing}ms)`);
        }
      } else if (process.env.NODE_ENV === 'production') {
        // In production, only log slow queries
        if (timing > 2000) {
          logger.warn(`🐢 SLOW QUERY (${timing}ms): ${msg}`);
        }
      }
    },
    benchmark: true, // Enable query timing
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      freezeTableName: true,
      // Add default scopes to exclude certain fields
      defaultScope: {
        attributes: { exclude: [] }
      }
    },
    pool: {
      max: poolMax,           // Increased from 5 to 20
      min: poolMin,           // Increased from 0 to 5
      acquire: poolAcquire,   // Increased from 30000 to 60000
      idle: poolIdle,         // Keep at 10000
      evict: 1000,            // Check for idle connections every second
    },
    // Retry configuration for failed queries
    retry: {
      max: 3,                 // Maximum retry attempts
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /SequelizeTimeOutError/
      ],
      backoffBase: 1000,      // Initial backoff duration in ms
      backoffExponent: 1.5,   // Backoff exponent
    }
  }
);

// Test database connection with retry logic
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.authenticate();
      logger.info('✅ Database connection established successfully.');
      
      // Log connection pool stats
      if (process.env.NODE_ENV === 'development') {
        try {
          const pool = sequelize.connectionManager.pool;
          logger.debug(`📊 Connection pool: size=${pool.size}, available=${pool.available}, waiting=${pool.waitingCount}`);
        } catch (poolError) {
          // Ignore pool stats errors
        }
      }
      
      return true;
    } catch (error) {
      // Check if this is an SSL error
      if (error.message && error.message.includes('does not support SSL')) {
        logger.warn('⚠️  Database does not support SSL. Retrying without SSL...');
        
        // Update dialectOptions to disable SSL
        sequelize.config.dialectOptions = {
          connectTimeout: 60000,
          statement_timeout: statementTimeout,
          idle_in_transaction_session_timeout: statementTimeout
        };
        
        // Also update the environment to remember this setting
        process.env.DB_SSL = 'false';
        
        // Continue to next retry with SSL disabled
        continue;
      }
      
      logger.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, error.message);
      
      if (i === retries - 1) {
        logger.error('❌ All database connection attempts failed.');
        logger.warn('⚠️  Continuing without database connection - some features may not work');
        
        // Instead of process.exit(1), return false
        // The app will continue running with limited functionality
        return false;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};

// Health check function - handles case when DB is not connected
const checkDatabaseHealth = async () => {
  try {
    if (!sequelize) {
      return { status: 'unhealthy', error: 'Database not initialized', timestamp: new Date().toISOString() };
    }
    await sequelize.query('SELECT 1');
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

// Get database stats - handles case when DB is not connected
const getDatabaseStats = async () => {
  try {
    if (!sequelize) {
      return null;
    }
    const stats = await sequelize.query(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT pg_database_size(current_database())) as database_size,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size_pretty
    `, { type: Sequelize.QueryTypes.SELECT });
    
    return stats[0];
  } catch (error) {
    logger.error('Error getting database stats:', error);
    return null;
  }
};

module.exports = { 
  sequelize, 
  testConnection,
  checkDatabaseHealth,
  getDatabaseStats 
};