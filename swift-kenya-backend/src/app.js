const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
require('dotenv').config();



const { sequelize, testConnection } = require('./config/database');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const sanitizeMiddleware = require('./middlewares/sanitize.middleware');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const logger = require('./utils/logger.util');

const app = express();
const PORT = process.env.PORT || 5000;

let server; // ✅ Needed for graceful shutdown

// ===============================
// 🔐 SECURITY MIDDLEWARE
// ===============================

app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production' ? undefined : false,
  })
);

app.use(
  cors({
    origin: true, // Allow all origins in development
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
    ],
  })
);

// ===============================
// 📦 BODY PARSING
// ===============================

app.use(
  express.json({
    limit: process.env.MAX_REQUEST_SIZE || '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_REQUEST_SIZE || '10mb',
  })
);

app.use(cookieParser());

// Clean empty strings middleware
const cleanEmptyStrings = require('./middlewares/cleanEmptyStrings.middleware');
app.use(cleanEmptyStrings);

// ===============================
// ⚡ PERFORMANCE
// ===============================

app.use(compression());

// ===============================
// 🛡 EXTRA SECURITY
// ===============================

app.use(hpp());
app.use(sanitizeMiddleware);

// ===============================
// 🚦 RATE LIMITING
// ===============================

app.use('/api', apiLimiter);

// ===============================
// 📝 REQUEST LOGGING
// ===============================

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// ===============================
// 🚀 ROUTES
// ===============================

app.use('/api', routes);

// ===============================
// ❌ 404 HANDLER (FIXED)
// ===============================

app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ===============================
// ⚠️ ERROR HANDLER
// ===============================

app.use(errorMiddleware);

// ===============================
// 🟢 START SERVER
// ===============================

const startServer = async () => {
  try {
    await testConnection();

    if (process.env.NODE_ENV === 'development') {
      // Use alter: true to preserve data while updating schema
      await sequelize.sync({ alter: true });
      logger.info('✅ Database synced (alter mode - data preserved)');
      
      // Ensure Super Admin exists
      const { User } = require('./models');
      const superAdminExists = await User.findOne({
        where: { role: 'SUPER_ADMIN' }
      });
      
      if (!superAdminExists) {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('Admin@123', 12);
        
        await User.create({
          full_name: 'System Administrator',
          email: 'pngugi396@gmail.com',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          is_active: true
        });
        
        logger.info('✅ Default Super Admin created');
        logger.info('📧 Email: pngugi396@gmail.com');
        logger.info('🔑 Password: Admin@123');
      } else {
        logger.info('✅ Super Admin already exists');
      }
    }

    server = app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

// ===============================
// 🔻 GRACEFUL SHUTDOWN
// ===============================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received. Shutting down gracefully...');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await sequelize.close();
      process.exit(0);
    });
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await sequelize.close();
      process.exit(0);
    });
  }
});

module.exports = app;