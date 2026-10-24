const express = require('express');
const superAdminRoutes = require('./superAdmin.routes');
const companyRoutes = require('./company.routes');
const walletRoutes = require('./wallet.routes');
const dashboardRoutes = require('./dashboard.routes');
const smsRoutes = require('./sms.routes');
const companyAuthRoutes = require('./companyAuth.routes');
const companyBranchRoutes = require('./companyBranch.routes');
const companyVehicleRoutes = require('./companyVehicle.routes');
const companyDriverRoutes = require('./companyDriver.routes');
const companyBranchOperatorRoutes = require('./companyBranchOperator.routes');
const companyWalletRoutes = require('./companyWallet.routes');
const mpesaRoutes = require('./mpesa.routes');
const companyReportsRoutes = require('./companyReports.routes')
const companyDashboardRoutes = require('./companyDashboard.routes')

const branchAuthRoutes = require('./branchAuth.routes');
const branchParcelRoutes = require('./branchParcel.routes');
const branchTripRoutes = require('./branchTrip.routes');
const branchNotificationRoutes = require('./branchNotification.routes');
const branchDashboardRoutes = require('./branchDashboard.routes');

const { HTTP_STATUS } = require('../config/constants');
const analyticsRoutes = require('./analytics.routes');

const router = express.Router();

// API routes
router.use('/super-admin', superAdminRoutes);
router.use('/companies', companyRoutes);
router.use('/wallets', walletRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/sms', smsRoutes);

router.use('/analytics', analyticsRoutes);

router.use('/company/auth', companyAuthRoutes);
router.use('/company/branches', companyBranchRoutes);
router.use('/company/vehicles', companyVehicleRoutes);
router.use('/company/drivers', companyDriverRoutes);
router.use('/company/branch-operators', companyBranchOperatorRoutes);
router.use('/company/wallet', companyWalletRoutes);
router.use('/mpesa', mpesaRoutes);
router.use('/company/reports', companyReportsRoutes)
router.use('/company/dashboard', companyDashboardRoutes)

// Branch routes - FIX: Mount each router once with its base path
router.use('/branch/auth', branchAuthRoutes);              // Base: /api/branch/auth
router.use('/branch/parcels', branchParcelRoutes);         // Base: /api/branch/parcels
router.use('/branch/trips', branchTripRoutes);             // Base: /api/branch/trips
router.use('/branch/notifications', branchNotificationRoutes); 
router.use('/branch/dashboard', branchDashboardRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API documentation endpoint
router.get('/', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Courier Management System API',
    version: '1.0.0',
    endpoints: {
      superAdmin: {
        register: 'POST /api/super-admin/register',
        login: 'POST /api/super-admin/login',
        profile: 'GET /api/super-admin/profile'
      },
      companies: {
        list: 'GET /api/companies',
        create: 'POST /api/companies',
        get: 'GET /api/companies/:id',
        update: 'PUT /api/companies/:id',
        status: 'PATCH /api/companies/:id/status'
      },
      wallets: {
        list: 'GET /api/wallets',
        get: 'GET /api/wallets/:id',
        adjust: 'POST /api/wallets/:id/adjust',
        transactions: 'GET /api/wallets/:id/transactions'
      },
      dashboard: {
        stats: 'GET /api/dashboard/stats',
        trends: 'GET /api/dashboard/trends',
        alerts: 'GET /api/dashboard/alerts'
      },
      sms: {
        logs: 'GET /api/sms',
        stats: 'GET /api/sms/stats',
        resend: 'POST /api/sms/:id/resend'
      }
    }
  });
});

module.exports = router;