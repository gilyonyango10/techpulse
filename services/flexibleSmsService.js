// Flexible SMS Service - supports multiple providers
const pool = require('../config/database');

class FlexibleSMSService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'mock'; // 'twilio', 'africastalking', or 'mock'
    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider) {
      case 'twilio':
        try {
          const twilio = require('twilio');
          this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
          this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
          console.log('✅ Twilio SMS service initialized');
        } catch (error) {
          console.error('❌ Twilio initialization failed:', error.message);
          this.provider = 'mock';
        }
        break;

      case 'africastalking':
        try {
          const AfricasTalking = require('africastalking');
          const credentials = {
            apiKey: process.env.AFRICASTALKING_API_KEY,
            username: process.env.AFRICASTALKING_USERNAME || 'sandbox'
          };
          const AT = AfricasTalking(credentials);
          this.client = AT.SMS;
          console.log('✅ Africa\'s Talking SMS service initialized');
        } catch (error) {
          console.error('❌ Africa\'s Talking initialization failed:', error.message);
          this.provider = 'mock';
        }
        break;

      default:
        console.log('📱 Using mock SMS service for development');
        this.provider = 'mock';
    }
  }

  // Send SMS using the configured provider
  async sendSMS(recipients, messageContent, userId = null) {
    try {
      let messageId = null;

      // Create message record if userId provided
      if (userId) {
        const messageResult = await pool.query(
          'INSERT INTO messages (user_id, message_content, total_recipients) VALUES ($1, $2, $3) RETURNING id',
          [userId, messageContent, recipients.length]
        );
        messageId = messageResult.rows[0].id;
      }

      let results = [];

      switch (this.provider) {
        case 'twilio':
          results = await this.sendViaTwilio(recipients, messageContent, messageId);
          break;
        case 'africastalking':
          results = await this.sendViaAfricasTalking(recipients, messageContent, messageId);
          break;
        default:
          results = await this.sendViaMock(recipients, messageContent, messageId);
      }

      // Update message statistics
      if (messageId) {
        const successCount = results.filter(r => r.status === 'sent').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        await pool.query(
          'UPDATE messages SET successful_sends = $1, failed_sends = $2 WHERE id = $3',
          [successCount, failedCount, messageId]
        );
      }

      return {
        success: true,
        provider: this.provider,
        messageId,
        results,
        summary: {
          total: recipients.length,
          sent: results.filter(r => r.status === 'sent').length,
          failed: results.filter(r => r.status === 'failed').length
        }
      };

    } catch (error) {
      console.error('SMS sending error:', error);
      throw new Error('Failed to send SMS');
    }
  }

  // Twilio implementation
  async sendViaTwilio(recipients, messageContent, messageId) {
    const results = [];

    for (const phoneNumber of recipients) {
      try {
        const messageOptions = {
          body: messageContent,
          to: phoneNumber
        };
        
        // Use Messaging Service SID if available, otherwise use phone number
        if (this.messagingServiceSid) {
          messageOptions.messagingServiceSid = this.messagingServiceSid;
        } else {
          messageOptions.from = this.fromNumber;
        }
        
        const message = await this.client.messages.create(messageOptions);

        const result = {
          phoneNumber,
          status: 'sent',
          messageId: message.sid,
          provider: 'twilio'
        };

        if (messageId) {
          await pool.query(
            'INSERT INTO recipients (message_id, phone_number, delivery_status, external_id) VALUES ($1, $2, $3, $4)',
            [messageId, phoneNumber, 'sent', message.sid]
          );
        }

        results.push(result);
      } catch (error) {
        const result = {
          phoneNumber,
          status: 'failed',
          error: error.message,
          provider: 'twilio'
        };

        if (messageId) {
          await pool.query(
            'INSERT INTO recipients (message_id, phone_number, delivery_status, error_message) VALUES ($1, $2, $3, $4)',
            [messageId, phoneNumber, 'failed', error.message]
          );
        }

        results.push(result);
      }
    }

    return results;
  }

  // Africa's Talking implementation
  async sendViaAfricasTalking(recipients, messageContent, messageId) {
    try {
      const options = {
        to: recipients,
        message: messageContent
      };

      const response = await this.client.send(options);
      const results = [];

      response.SMSMessageData.Recipients.forEach((recipient, index) => {
        const result = {
          phoneNumber: recipients[index],
          status: recipient.status === 'Success' ? 'sent' : 'failed',
          messageId: recipient.messageId,
          cost: recipient.cost,
          provider: 'africastalking'
        };

        if (messageId) {
          pool.query(
            'INSERT INTO recipients (message_id, phone_number, delivery_status, external_id, cost) VALUES ($1, $2, $3, $4, $5)',
            [messageId, recipients[index], result.status, recipient.messageId, recipient.cost]
          );
        }

        results.push(result);
      });

      return results;
    } catch (error) {
      // If bulk send fails, mark all as failed
      const results = recipients.map(phoneNumber => ({
        phoneNumber,
        status: 'failed',
        error: error.message,
        provider: 'africastalking'
      }));

      if (messageId) {
        recipients.forEach(phoneNumber => {
          pool.query(
            'INSERT INTO recipients (message_id, phone_number, delivery_status, error_message) VALUES ($1, $2, $3, $4)',
            [messageId, phoneNumber, 'failed', error.message]
          );
        });
      }

      return results;
    }
  }

  // Mock implementation for testing
  async sendViaMock(recipients, messageContent, messageId) {
    const results = [];

    for (const phoneNumber of recipients) {
      // Simulate some failures for testing
      const isSuccess = Math.random() > 0.1; // 90% success rate

      const result = {
        phoneNumber,
        status: isSuccess ? 'sent' : 'failed',
        messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: 'mock',
        ...(isSuccess ? {} : { error: 'Mock failure for testing' })
      };

      if (messageId) {
        await pool.query(
          'INSERT INTO recipients (message_id, phone_number, delivery_status, external_id, error_message) VALUES ($1, $2, $3, $4, $5)',
          [messageId, phoneNumber, result.status, result.messageId, result.error || null]
        );
      }

      results.push(result);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  // Send OTP (works with any provider)
  async sendOTP(phoneNumber, otpCode) {
    const message = `Your TextPulse verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;
    
    try {
      const result = await this.sendSMS([phoneNumber], message);
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.results[0]?.messageId
      };
    } catch (error) {
      throw new Error('Failed to send OTP SMS');
    }
  }
}

module.exports = new FlexibleSMSService();
