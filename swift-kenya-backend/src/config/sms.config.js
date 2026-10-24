// config/sms.config.js
module.exports = {
  sms: {
    enabled: process.env.AT_SANDBOX === 'false' ? true : true,
    provider: 'africastalking',
   debugMode: false,
    costPerMessage: 1,
    maxRetries: 3,
    retryDelay: 1000,
    rateLimit: {
      maxPerSecond: 10
    },
    africastalking: {
      username: process.env.AT_USERNAME,
      apiKey: process.env.AT_API_KEY ? process.env.AT_API_KEY.trim() : null,
      senderId: process.env.AT_SENDER_ID || null,
      isSandbox: process.env.AT_SANDBOX === 'true'
    }
  }
};