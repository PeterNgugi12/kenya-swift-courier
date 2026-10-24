const express = require('express');
const branchParcelController = require('../controllers/branchParcel.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All routes require authentication and BRANCH_OPERATOR role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.BRANCH_OPERATOR));

// GET /api/branch/parcels/branches
router.get('/branches', branchParcelController.getBranches);

// GET /api/branch/parcels/trips/available
router.get('/trips/available', branchParcelController.getAvailableTrips);

// GET /api/branch/parcels/wallet
router.get('/wallet', branchParcelController.getWalletInfo);

// GET /api/branch/parcels/preview-tracking
router.get('/preview-tracking', branchParcelController.previewTracking);

// GET /api/branch/parcels - Get all parcels with pagination
router.get('/', branchParcelController.getAllParcels);

// POST /api/branch/parcels
router.post('/', branchParcelController.validateCreate, branchParcelController.createParcel);
// GET /api/branch/parcels/tracking/:trackingNumber - Get parcel by tracking
router.get('/tracking/:trackingNumber', branchParcelController.getParcelByTracking);

// POST /api/branch/parcels/collect-payment - Collect payment
router.post('/collect-payment', branchParcelController.collectPayment);

// POST /api/branch/parcels/release - Release parcel
router.post('/release', branchParcelController.releaseParcel);

module.exports = router;