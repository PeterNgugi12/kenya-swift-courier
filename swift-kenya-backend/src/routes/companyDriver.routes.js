const express = require('express');
const companyDriverController = require('../controllers/companyDriver.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All driver routes require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

// Driver CRUD operations
router.get('/', companyDriverController.getAllDrivers);
router.get('/stats', companyDriverController.getDriverStats);
router.get('/available-vehicles', companyDriverController.getAvailableVehicles);
router.post('/', companyDriverController.createDriver);
router.get('/:id', companyDriverController.getDriverById);
router.put('/:id', companyDriverController.updateDriver);
router.patch('/:id/status', companyDriverController.updateDriverStatus);
router.delete('/:id', companyDriverController.deleteDriver);

module.exports = router;