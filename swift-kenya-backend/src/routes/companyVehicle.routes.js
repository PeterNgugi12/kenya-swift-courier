const express = require('express');
const companyVehicleController = require('../controllers/companyVehicle.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All vehicle routes require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

// Vehicle CRUD operations
router.get('/', companyVehicleController.getAllVehicles);
router.get('/stats', companyVehicleController.getVehicleStats);
router.post('/', companyVehicleController.createVehicle);
router.get('/:id', companyVehicleController.getVehicleById);
router.put('/:id', companyVehicleController.updateVehicle);
router.patch('/:id/status', companyVehicleController.updateVehicleStatus);
router.delete('/:id', companyVehicleController.deleteVehicle);
router.post('/:id/assign-driver', companyVehicleController.assignDriver);

module.exports = router;