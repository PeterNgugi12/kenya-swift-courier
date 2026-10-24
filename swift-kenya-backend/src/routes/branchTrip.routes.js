const express = require('express');
const branchTripController = require('../controllers/branchTrip.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All routes require authentication and BRANCH_OPERATOR role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.BRANCH_OPERATOR));

// ==================== SPECIFIC ROUTES (NO PARAMETERS) ====================
router.get('/incoming', branchTripController.getIncomingTrips);
router.get('/history', branchTripController.getTripHistory); // ✅ ADD THIS LINE
router.get('/available-vehicles', branchTripController.getAvailableVehicles);
router.get('/available-drivers', branchTripController.getAvailableDrivers);
router.get('/destination-branches', branchTripController.getDestinationBranches);
router.get('/stats', branchTripController.getTripStats);

// ==================== SMS ROUTES ====================
router.post('/sms/send-pickup-notification', branchTripController.sendPickupNotification);

// ==================== PARAMETERIZED ROUTES ====================
router.get('/', branchTripController.getAllTrips);
router.post('/', branchTripController.validateCreate, branchTripController.createTrip);
router.get('/:id', branchTripController.getTripById);
router.patch('/:id/status', branchTripController.updateTripStatus);
router.get('/:tripId/parcels', branchTripController.getTripParcels);
router.post('/:tripId/confirm-arrival', branchTripController.confirmTripArrival);

module.exports = router;