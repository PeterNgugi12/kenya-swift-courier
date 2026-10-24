require('dotenv').config();

// config/mpesa.config.js
module.exports = {
  mpesa: {
    environment: process.env.MPESA_ENVIRONMENT || 'production',
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey: process.env.MPESA_PASSKEY,
    businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    urls: {
      sandbox: {
        auth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        query: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      },
      production: {
        auth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        query: 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      }
    }
  }
};