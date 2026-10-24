const express = require('express');
const mpesaController = require('../controllers/mpesa.controller');

const router = express.Router();

// Public routes for M-Pesa callbacks (no auth required)
router.post('/callback', mpesaController.handleCallback);
router.post('/timeout', mpesaController.handleTimeout);
router.get('/status/:checkoutRequestID', mpesaController.queryStatus);

module.exports = router;