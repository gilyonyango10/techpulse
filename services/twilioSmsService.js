const twilio = require('twilio');
const pool = require('../config/database');

class TwilioSMSService {
  constructor() {
    // Initialize Twilio client
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  // Send SMS to single recipient
  async sendSMS(recipients, messageContent, userId = null) {
    try {
      const results = [];
      let messageId = null;

      // Create message record if userId provided
      if (userId) {
        const messageResult = await pool.query(
          'INSERT INTO messages (user_id, message_content, total_recipients) VALUES ($1, $2, $3) RETURNING id',
          [userId, messageContent, recipients.length]
        );
        messageId = messageResult.rows[0].id;
      }

      // Send SMS to each recipient
      for (const phoneNumber of recipients) {
        try {
          const message = await this.client.messages.create({
            body: messageContent,
            from: this.fromNumber,
            to: phoneNumber
          });

          const result = {
            phoneNumber,
            status: 'sent',
            messageId: message.sid,
            cost: message.price || '0.00'
          };

          // Store recipient record if messageId exists
          if (messageId) {
            await pool.query(
              'INSERT INTO recipients (message_id, phone_number, delivery_status, external_id) VALUES ($1, $2, $3, $4)',
              [messageId, phoneNumber, 'sent', message.sid]
            );
          }

          results.push(result);
        } catch (error) {
          console.error(`Failed to send SMS to ${phoneNumber}:`, error);
          
          const result = {
            phoneNumber,
            status: 'failed',
            error: error.message
          };

          // Store failed recipient record
          if (messageId) {
            await pool.query(
              'INSERT INTO recipients (message_id, phone_number, delivery_status, error_message) VALUES ($1, $2, $3, $4)',
              [messageId, phoneNumber, 'failed', error.message]
            );
          }

          results.push(result);
        }
      }

      // Update message statistics
      if (messageId) {
        const successCount = results.filter(r => r.status === 'sent').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        await pool.query(
          'UPDATE messages SET sent_count = $1, failed_count = $2, status = $3 WHERE id = $4',
          [successCount, failedCount, successCount > 0 ? 'completed' : 'failed', messageId]
        );
      }

      return {
        success: true,
        messageId,
        results,
        summary: {
          total: recipients.length,
          sent: results.filter(r => r.status === 'sent').length,
          failed: results.filter(r => r.status === 'failed').length
        }
      };

    } catch (error) {
      console.error('Bulk SMS error:', error);
      throw new Error('Failed to send bulk SMS');
    }
  }

  // Send OTP SMS
  async sendOTP(phoneNumber, otpCode) {
    try {
      const message = `Your TextPulse verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('OTP SMS error:', error);
      throw new Error('Failed to send OTP SMS');
    }
  }

  // Check delivery status
  async checkDeliveryStatus(messageSid) {
    try {
      const message = await this.client.messages(messageSid).fetch();
      return {
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      console.error('Status check error:', error);
      return { status: 'unknown', error: error.message };
    }
  }
}

module.exports = new TwilioSMSService();
