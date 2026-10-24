const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = 'logs';

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define custom colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  slow: 'red',
  performance: 'cyan'
};

winston.addColors(colors);

// Custom format for console with colors and emojis
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    // Add emojis based on level
    let emoji = '';
    switch (level.replace(/\u001b\[\d+m/g, '')) { // Remove color codes for emoji selection
      case 'error': emoji = '❌'; break;
      case 'warn': emoji = '⚠️'; break;
      case 'info': emoji = '📦'; break;
      case 'http': emoji = '🌐'; break;
      case 'debug': emoji = '🔧'; break;
      case 'performance': emoji = '⚡'; break;
      case 'slow': emoji = '🐢'; break;
      default: emoji = '📝';
    }
    
    let logMessage = `${timestamp} ${emoji} ${level}: ${message}`;
    
    // Add metadata if present (but not for performance logs)
    if (Object.keys(meta).length > 0 && !meta.performance && !meta.slow) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    // Add service name if present
    if (service) {
      logMessage = `[${service}] ${logMessage}`;
    }
    
    return logMessage;
  })
);

// JSON format for files
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    performance: 4,
    debug: 5,
    slow: 1 // Same level as warn
  },
  defaultMeta: { service: 'courier-api' },
  transports: [
    // Error log file
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined log file
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Performance log file (optional)
    new winston.transports.File({ 
      filename: path.join(logDir, 'performance.log'),
      level: 'performance',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
} else {
  // In production, still log errors to console for Docker/container logs
  logger.add(new winston.transports.Console({
    level: 'error',
    format: winston.format.simple()
  }));
}

// Helper method to log HTTP requests
logger.logRequest = (req, res, responseTime) => {
  const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`;
  
  if (res.statusCode >= 500) {
    logger.error(message, { 
      ip: req.ip,
      user: req.user?.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime
    });
  } else if (res.statusCode >= 400) {
    logger.warn(message, { 
      ip: req.ip,
      user: req.user?.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime
    });
  } else {
    logger.http(message, { 
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime
    });
  }
};

// Helper method to track performance
logger.performance = (label, startTime, metadata = {}) => {
  const duration = Date.now() - startTime;
  
  if (duration > 1000) {
    logger.log('slow', `🐢 ${label} took ${duration}ms`, { 
      duration, 
      threshold: '>1000ms',
      ...metadata 
    });
  } else {
    logger.log('performance', `⚡ ${label} took ${duration}ms`, { 
      duration,
      ...metadata
    });
  }
  
  return duration;
};

// Helper method to log database queries
logger.query = (sql, duration, metadata = {}) => {
  const level = duration > 1000 ? 'slow' : (duration > 100 ? 'performance' : 'debug');
  
  logger.log(level, `Query (${duration}ms): ${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`, {
    duration,
    fullQuery: duration > 1000 ? sql : undefined, // Only log full SQL for slow queries
    ...metadata
  });
};

// Helper to log cache operations
logger.cache = (operation, key, duration, metadata = {}) => {
  logger.debug(`📦 Cache ${operation}: ${key} (${duration}ms)`, metadata);
};

// Helper to log user actions
logger.userAction = (userId, action, metadata = {}) => {
  logger.info(`👤 User ${userId}: ${action}`, {
    userId,
    action,
    ...metadata
  });
};

// Helper to log business events
logger.event = (event, data = {}) => {
  logger.info(`📊 Event: ${event}`, data);
};

// Stream for Morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

module.exports = logger;