const AfricasTalking = require('africastalking');
const pool = require('../config/database');

// Initialize Africa's Talking
const credentials = {
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox'
};

const AT = AfricasTalking(credentials);
const sms = AT.SMS;

class SMSService {
  // Send SMS to multiple recipients
  async sendBulkSMS(messageContent, recipients, userId) {
    try {
      // Create message record in database
      const messageResult = await pool.query(
        'INSERT INTO messages (user_id, message_content, total_recipients) VALUES ($1, $2, $3) RETURNING id',
        [userId, messageContent, recipients.length]
      );
      
      const messageId = messageResult.rows[0].id;
      
      // Insert recipients into database
      const recipientInserts = recipients.map(phone => 
        pool.query(
          'INSERT INTO recipients (message_id, phone_number, delivery_status) VALUES ($1, $2, $3)',
          [messageId, phone, 'pending']
        )
      );
      
      await Promise.all(recipientInserts);
      
      // Send SMS using Africa's Talking
      let successCount = 0;
      let failCount = 0;
      
      try {
        const options = {
          to: recipients,
          message: messageContent,
          from: process.env.AFRICASTALKING_SHORTCODE || null
        };
        
        const response = await sms.send(options);
        
        // Process response and update database
        if (response.SMSMessageData && response.SMSMessageData.Recipients) {
          for (const recipient of response.SMSMessageData.Recipients) {
            const status = recipient.status === 'Success' ? 'sent' : 'failed';
            const errorMessage = recipient.status !== 'Success' ? recipient.status : null;
            
            await pool.query(
              'UPDATE recipients SET delivery_status = $1, error_message = $2, sent_at = CURRENT_TIMESTAMP WHERE message_id = $3 AND phone_number = $4',
              [status, errorMessage, messageId, recipient.number]
            );
            
            if (status === 'sent') {
              successCount++;
            } else {
              failCount++;
            }
          }
        }
      } catch (smsError) {
        console.error('SMS sending error:', smsError);
        
        // Mark all as failed if API call fails
        await pool.query(
          'UPDATE recipients SET delivery_status = $1, error_message = $2 WHERE message_id = $3',
          ['failed', 'API Error: ' + smsError.message, messageId]
        );
        
        failCount = recipients.length;
      }
      
      // Update message statistics
      await pool.query(
        'UPDATE messages SET successful_sends = $1, failed_sends = $2 WHERE id = $3',
        [successCount, failCount, messageId]
      );
      
      return {
        messageId,
        totalRecipients: recipients.length,
        successCount,
        failCount,
        success: true
      };
      
    } catch (error) {
      console.error('Bulk SMS error:', error);
      throw new Error('Failed to send bulk SMS: ' + error.message);
    }
  }
  
  // Mock SMS service for testing (when API key is not available)
  async sendMockSMS(messageContent, recipients, userId) {
    try {
      // Create message record in database
      const messageResult = await pool.query(
        'INSERT INTO messages (user_id, message_content, total_recipients) VALUES ($1, $2, $3) RETURNING id',
        [userId, messageContent, recipients.length]
      );
      
      const messageId = messageResult.rows[0].id;
      
      // Simulate sending with random success/failure
      let successCount = 0;
      let failCount = 0;
      
      for (const phone of recipients) {
        const isSuccess = Math.random() > 0.1; // 90% success rate
        const status = isSuccess ? 'sent' : 'failed';
        const errorMessage = isSuccess ? null : 'Mock failure for testing';
        
        await pool.query(
          'INSERT INTO recipients (message_id, phone_number, delivery_status, error_message, sent_at) VALUES ($1, $2, $3, $4, $5)',
          [messageId, phone, status, errorMessage, isSuccess ? new Date() : null]
        );
        
        if (isSuccess) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      // Update message statistics
      await pool.query(
        'UPDATE messages SET successful_sends = $1, failed_sends = $2 WHERE id = $3',
        [successCount, failCount, messageId]
      );
      
      return {
        messageId,
        totalRecipients: recipients.length,
        successCount,
        failCount,
        success: true,
        mock: true
      };
      
    } catch (error) {
      console.error('Mock SMS error:', error);
      throw new Error('Failed to send mock SMS: ' + error.message);
    }
  }
  
  // Get message history for a user
  async getMessageHistory(userId, limit = 50, offset = 0) {
    try {
      const result = await pool.query(`
        SELECT 
          m.id,
          m.message_content,
          m.total_recipients,
          m.successful_sends,
          m.failed_sends,
          m.created_at,
          COUNT(r.id) as recipient_count
        FROM messages m
        LEFT JOIN recipients r ON m.id = r.message_id
        WHERE m.user_id = $1
        GROUP BY m.id, m.message_content, m.total_recipients, m.successful_sends, m.failed_sends, m.created_at
        ORDER BY m.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
      
      return result.rows;
    } catch (error) {
      console.error('Get message history error:', error);
      throw new Error('Failed to retrieve message history');
    }
  }
  
  // Get detailed message with recipients
  async getMessageDetails(messageId, userId) {
    try {
      const messageResult = await pool.query(
        'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
        [messageId, userId]
      );
      
      if (messageResult.rows.length === 0) {
        throw new Error('Message not found');
      }
      
      const recipientsResult = await pool.query(
        'SELECT phone_number, delivery_status, error_message, sent_at FROM recipients WHERE message_id = $1 ORDER BY id',
        [messageId]
      );
      
      return {
        message: messageResult.rows[0],
        recipients: recipientsResult.rows
      };
    } catch (error) {
      console.error('Get message details error:', error);
      throw new Error('Failed to retrieve message details');
    }
  }
}

module.exports = new SMSService();
