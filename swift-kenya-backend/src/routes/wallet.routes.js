const express = require('express');
const walletController = require('../controllers/wallet.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const walletValidation = require('../validations/wallet.validation');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All wallet routes require authentication and SUPER_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.SUPER_ADMIN));

router.get('/', walletController.getAllWallets);

router.get('/revenue/platform', walletController.getPlatformRevenue);

router.get('/:id', walletController.getWalletById);

router.get('/company/:companyId', walletController.getWalletByCompanyId);

router.post(
  '/:id/adjust',
  validate(walletValidation.adjust),
  walletController.adjustWalletBalance
);

router.get('/:id/transactions', walletController.getWalletTransactions);

module.exports = router;