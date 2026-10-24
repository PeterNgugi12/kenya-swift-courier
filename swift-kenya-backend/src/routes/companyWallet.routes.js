const express = require('express');
const companyWalletController = require('../controllers/companyWallet.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All wallet routes require authentication and COMPANY_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COMPANY_ADMIN));

router.get('/', companyWalletController.getWallet);
router.get('/transactions', companyWalletController.getTransactions);
router.get('/stats', companyWalletController.getStats);
router.post('/mpesa-topup', companyWalletController.initiateMpesaTopUp);
router.get('/mpesa-status/:checkoutRequestId', companyWalletController.checkMpesaStatus);

module.exports = router;