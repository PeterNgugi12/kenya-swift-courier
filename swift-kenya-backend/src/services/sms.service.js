// services/sms.service.js
const axios = require('axios');
const { SMSLog, Parcel, Branch, Company } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const smsConfig = require('../config/sms.config');
const { sequelize } = require('../config/database');

class SMSService {
  constructor() {
    this.config = smsConfig.sms;
    this.provider = this.config.provider;
    this.enabled = this.config.enabled;
    this.debugMode = this.config.debugMode;
    
    // Initialize Africa's Talking if configured
    if (this.provider === 'africastalking' && this.config.africastalking.apiKey) {
      this.initAfricaTalking();
    } else {
      console.log('⚠️ Africa\'s Talking not configured - using mock service');
    }
  }

  /**
   * Initialize Africa's Talking
   */
  initAfricaTalking() {
    const atConfig = this.config.africastalking;
    
    // Store credentials for API calls
    this.atUsername = atConfig.username;
    this.atApiKey = atConfig.apiKey ? atConfig.apiKey.trim() : null;
    
    // Handle sender ID - set to null if empty or not provided
    this.atSenderId = atConfig.senderId && atConfig.senderId.trim() !== '' 
      ? atConfig.senderId.trim() 
      : null;
    
    this.atIsSandbox = atConfig.isSandbox;
    
    // Set API endpoint based on environment
    this.atBaseURL = this.atIsSandbox 
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';
    
    console.log(`📱 Africa's Talking initialized in ${this.atIsSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);
    console.log(`📱 Sender ID: ${this.atSenderId || 'Not set (will use default)'}`);
    console.log(`📱 Username: ${this.atUsername}`);
    console.log(`📱 API Key: ${this.atApiKey ? '✅ Present' : '❌ Missing'}`);
  }

  /**
   * Format phone number to international format (254...)
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove any non-numeric characters
    let cleaned = phoneNumber.toString().replace(/\D/g, '');
    
    // If it starts with 0, replace with 254 (Kenya)
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    
    // If it starts with 254, keep as is
    else if (cleaned.startsWith('254')) {
      // Already correct format
    }
    
    // If it's 9 digits (typical Safaricom), add 254
    else if (cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate phone number
   */
  isValidPhoneNumber(phoneNumber) {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Kenyan phone numbers should be 12 digits (254 + 9 digits)
    return formatted && formatted.length === 12 && formatted.startsWith('254');
  }

  /**
   * Send SMS using Africa's Talking
   */
  async sendViaAfricaTalking(phoneNumber, message) {
    try {
      if (!this.atApiKey) {
        throw new Error('Africa\'s Talking API key not configured');
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      if (!this.isValidPhoneNumber(formattedNumber)) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }

      console.log(`📤 Sending via Africa's Talking to ${formattedNumber}...`);
      console.log(`🔑 API Key: ${this.atApiKey ? '✅ Present' : '❌ Missing'}`);
      console.log(`👤 Username: ${this.atUsername || 'sandbox'}`);
      console.log(`📱 Sender ID: ${this.atSenderId || 'Not provided (using default)'}`);
      console.log(`🌐 Mode: ${this.atIsSandbox ? 'SANDBOX' : 'PRODUCTION'}`);

      // Prepare request data - start with required fields
      const data = new URLSearchParams({
        username: this.atUsername || 'sandbox',
        to: formattedNumber,
        message: message,
      });

      // Only add 'from' parameter if senderId exists AND is not empty
      if (this.atSenderId && this.atSenderId.trim() !== '') {
        data.append('from', this.atSenderId.trim());
        console.log(`📱 Using sender ID: ${this.atSenderId}`);
      } else {
        console.log('📱 No sender ID provided - Africa\'s Talking will use default');
      }

      // Make API request
      const response = await axios({
        method: 'post',
        url: this.atBaseURL,
        headers: {
          'apiKey': this.atApiKey.trim(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        data: data,
        timeout: 10000 // 10 second timeout
      });

      console.log('✅ Africa\'s Talking Response:', JSON.stringify(response.data, null, 2));

      // Parse response
      const result = response.data.SMSMessageData || { Recipients: [] };
      const recipient = result.Recipients?.[0] || {};
      
      const success = recipient.status === 'Success';
      const messageId = recipient.messageId || uuidv4();
      const cost = recipient.cost || '0';

      return {
        success,
        messageId,
        cost: parseFloat(cost.replace(/[^0-9.]/g, '')) || this.config.costPerMessage,
        provider: 'africastalking',
        status: recipient.status,
        response: result
      };

    } catch (error) {
      console.error('❌ Africa\'s Talking API Error:');
      console.error('  - Message:', error.message);
      console.error('  - Status:', error.response?.status);
      console.error('  - Response:', JSON.stringify(error.response?.data, null, 2));
      
      // Check for specific error codes
      if (error.response?.status === 403) {
        console.error('🔑 Authentication failed - check your API key and username');
      } else if (error.response?.status === 400) {
        console.error('📝 Bad request - check phone number format and sender ID');
      }

      throw error;
    }
  }

  /**
   * Mock SMS sending for development
   */
  async sendMockSMS(phoneNumber, message) {
    console.log('\n' + '='.repeat(50));
    console.log('📱 MOCK SMS SERVICE');
    console.log('='.repeat(50));
    console.log(`📞 To: ${phoneNumber}`);
    console.log(`📨 Message: ${message}`);
    console.log(`💰 Cost: KES ${this.config.costPerMessage}`);
    console.log('='.repeat(50) + '\n');

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      messageId: uuidv4(),
      cost: this.config.costPerMessage,
      provider: 'mock',
      mock: true,
      status: 'Success'
    };
  }

  /**
   * Main send SMS method
   */
  async sendSMS(phoneNumber, message, options = {}) {
    // Check if SMS is enabled
    if (!this.enabled && !options.force) {
      console.log('⚠️ SMS sending is disabled');
      return {
        success: false,
        message: 'SMS sending is disabled',
        disabled: true
      };
    }

    // Validate inputs
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }
    if (!message) {
      throw new Error('Message is required');
    }

    // Format phone number
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    try {
      let result;

      // Send via selected provider
      if (this.provider === 'africastalking' && this.enabled && !this.debugMode) {
        result = await this.sendViaAfricaTalking(formattedNumber, message);
      } else {
        // Use mock service for development or when provider not configured
        result = await this.sendMockSMS(formattedNumber, message);
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to send SMS:', error);
      
      // Retry logic
      if (options.retry && options.retryCount < this.config.maxRetries) {
        console.log(`🔄 Retrying... Attempt ${options.retryCount + 1}/${this.config.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.sendSMS(phoneNumber, message, {
          ...options,
          retryCount: (options.retryCount || 0) + 1
        });
      }

      throw error;
    }
  }

  /**
   * Check for duplicate SMS
   */
  async checkDuplicateSMS(phoneNumber, message, minutesWindow = 5) {
    const timeWindow = new Date(Date.now() - minutesWindow * 60 * 1000);
    
    const existing = await SMSLog.findOne({
      where: {
        phone_number: phoneNumber,
        message: message,
        status: 'sent',
        created_at: {
          [Op.gte]: timeWindow
        }
      }
    });

    return !!existing;
  }

  /**
   * Send pickup notification
   */
  async sendPickupNotification({ tracking_number, phone_number, receiver_name, branchId, companyId, userId }) {
    try {
      console.log('\n' + '📱'.repeat(10));
      console.log('📱 SENDING PICKUP NOTIFICATION');
      console.log('📱'.repeat(10) + '\n');
      console.log('Input:', { tracking_number, phone_number, receiver_name, branchId, companyId, userId });

      // Validate phone number
      if (!this.isValidPhoneNumber(phone_number)) {
        throw new Error(`Invalid phone number format: ${phone_number}`);
      }

      // Get branch details
      const branch = await Branch.findOne({
        where: { id: branchId },
        include: [
          {
            model: Company,
            as: 'branchCompany',
            attributes: ['id', 'name']
          }
        ]
      });

      if (!branch) {
        throw new Error(`Branch not found with ID: ${branchId}`);
      }

      // Get parcel details
      const parcel = await Parcel.findOne({
        where: { tracking_number }
      });

      // Prepare message
      const companyName = branch.branchCompany?.name || 'Courier Service';
      const branchName = branch.name || 'our branch';
      const officeHours = 'our offices are open 8am to 7pm from Monday to Saturday';
      
      const message = `Dear ${receiver_name}, your parcel ${tracking_number} has arrived and is ready for pickup at ${branchName} (${companyName}). Please note, ${officeHours}.`;

      console.log('📨 Message:', message);
      console.log('📞 Phone:', phone_number);
      console.log('📍 Branch:', branch.name);

      // Check for duplicate (prevent sending same SMS within 5 minutes)
      const isDuplicate = await this.checkDuplicateSMS(phone_number, message, 5);
      if (isDuplicate) {
        console.log('⚠️ Duplicate SMS detected within 5 minutes window');
        
        // Log the duplicate attempt
        await SMSLog.create({
          id: uuidv4(),
          company_id: companyId,
          parcel_id: parcel?.id || null,
          phone_number,
          receiver_name,
          message,
          status: 'duplicate',
          cost: 0,
          created_at: new Date(),
          created_by: userId
        });

        return {
          success: true,
          duplicate: true,
          message: 'SMS already sent recently'
        };
      }

      // Send SMS
      const smsResult = await this.sendSMS(phone_number, message, {
        checkDuplicate: false, // Already checked above
        retry: true,
        force: true
      });

      // Log to database
      const smsLog = await SMSLog.create({
        id: uuidv4(),
        company_id: companyId,
        parcel_id: parcel?.id || null,
        phone_number,
        receiver_name,
        message,
        status: smsResult.success ? 'sent' : 'failed',
        cost: smsResult.cost || 0,
        provider_reference: smsResult.messageId,
        provider: smsResult.provider,
        created_at: new Date(),
        created_by: userId,
        provider_response: smsResult
      });

      console.log(`✅ SMS logged with ID: ${smsLog.id}`);

      // Update parcel SMS status if parcel exists and SMS was sent
      if (parcel && smsResult.success) {
        await parcel.update({
          sms_sent: true,
          sms_sent_at: new Date()
        });
        console.log(`✅ Updated parcel ${tracking_number} SMS status`);
      }

      return {
        success: true,
        sms_log_id: smsLog.id,
        provider: smsResult.provider,
        cost: smsResult.cost,
        duplicate: false,
        message: 'SMS sent successfully',
        message_preview: message.substring(0, 50) + '...'
      };

    } catch (error) {
      console.error('❌ Error in sendPickupNotification:', error);

      // Log failed attempt
      try {
        await SMSLog.create({
          id: uuidv4(),
          company_id: companyId,
          phone_number,
          receiver_name,
          message: error.message,
          status: 'error',
          cost: 0,
          created_at: new Date(),
          created_by: userId,
          error_message: error.message
        });
      } catch (logError) {
        console.error('Failed to log SMS error:', logError);
      }

      throw error;
    }
  }

  /**
   * Send bulk pickup notifications
   */
  async sendBulkPickupNotifications(parcels, branchId, companyId, userId) {
    const results = {
      total: parcels.length,
      successful: 0,
      failed: 0,
      duplicate: 0,
      details: []
    };

    console.log(`📦 Sending bulk SMS to ${parcels.length} recipients`);

    for (const parcel of parcels) {
      try {
        const result = await this.sendPickupNotification({
          tracking_number: parcel.tracking_number,
          phone_number: parcel.receiver_phone,
          receiver_name: parcel.receiver_name,
          branchId,
          companyId,
          userId
        });

        if (result.duplicate) {
          results.duplicate++;
        } else if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }

        results.details.push({
          tracking_number: parcel.tracking_number,
          success: result.success,
          duplicate: result.duplicate || false,
          sms_log_id: result.sms_log_id
        });

        // Rate limiting - 1 second per message max
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed for ${parcel.tracking_number}:`, error.message);
        results.failed++;
        results.details.push({
          tracking_number: parcel.tracking_number,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Bulk SMS complete: ${results.successful} sent, ${results.duplicate} duplicate, ${results.failed} failed`);
    return results;
  }

  /**
   * Get SMS logs with filters
   */
  async getSMSLogs(filters = {}, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const { status, company_id, from_date, to_date, branch_id } = filters;

    const where = {};
    if (status) where.status = status;
    if (company_id) where.company_id = company_id;
    if (branch_id) where.branch_id = branch_id;
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at[Op.gte] = new Date(from_date);
      if (to_date) where.created_at[Op.lte] = new Date(to_date);
    }

    const { count, rows } = await SMSLog.findAndCountAll({
      where,
      include: [
        {
          model: Company,
          as: 'smsCompany',
          attributes: ['id', 'name', 'code']
        },
        {
          model: Parcel,
          as: 'smsParcel',
          attributes: ['id', 'tracking_number']
        }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']]
    });

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      data: rows
    };
  }

  /**
   * Get SMS statistics
   */
  async getSMSStats(companyId = null, branchId = null, days = 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const where = {};
    if (companyId) where.company_id = companyId;
    if (branchId) where.branch_id = branchId;

    // Today's stats
    const todayStats = await SMSLog.findAll({
      where: {
        ...where,
        created_at: { [Op.gte]: today }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'sent'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN status = 'sent' THEN 1 ELSE 0 END")
        ), 'delivered'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN status = 'failed' THEN 1 ELSE 0 END")
        ), 'failed'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END")
        ), 'duplicate'],
        [sequelize.fn('SUM', sequelize.col('cost')), 'total_cost']
      ],
      raw: true
    });

    // Weekly stats
    const weeklyStats = await SMSLog.findAll({
      where: {
        ...where,
        created_at: { [Op.gte]: weekAgo }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'sent'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN status = 'sent' THEN 1 ELSE 0 END")
        ), 'delivered'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN status = 'failed' THEN 1 ELSE 0 END")
        ), 'failed']
      ],
      raw: true
    });

    // Monthly stats
    const monthlyStats = await SMSLog.findAll({
      where: {
        ...where,
        created_at: { [Op.gte]: monthAgo }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'sent'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN status = 'sent' THEN 1 ELSE 0 END")
        ), 'delivered'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN status = 'failed' THEN 1 ELSE 0 END")
        ), 'failed'],
        [sequelize.fn('SUM', sequelize.col('cost')), 'total_cost']
      ],
      raw: true
    });

    const t = todayStats[0] || { sent: 0, delivered: 0, failed: 0, duplicate: 0, total_cost: 0 };
    const w = weeklyStats[0] || { sent: 0, delivered: 0, failed: 0 };
    const m = monthlyStats[0] || { sent: 0, delivered: 0, failed: 0, total_cost: 0 };

    const deliveryRate = t.sent > 0 ? (parseInt(t.delivered) / parseInt(t.sent)) * 100 : 98.4;

    return {
      today: {
        sent: parseInt(t.sent) || 0,
        delivered: parseInt(t.delivered) || 0,
        failed: parseInt(t.failed) || 0,
        duplicate: parseInt(t.duplicate) || 0,
        total_cost: parseFloat(t.total_cost) || 0
      },
      weekly: {
        sent: parseInt(w.sent) || 0,
        delivered: parseInt(w.delivered) || 0,
        failed: parseInt(w.failed) || 0,
        delivery_rate: w.sent > 0 ? ((parseInt(w.delivered) / parseInt(w.sent)) * 100) : 98.1
      },
      monthly: {
        sent: parseInt(m.sent) || 0,
        delivered: parseInt(m.delivered) || 0,
        failed: parseInt(m.failed) || 0,
        total_cost: parseFloat(m.total_cost) || 0
      },
      delivery_rate: parseFloat(deliveryRate.toFixed(1))
    };
  }
}

module.exports = new SMSService();