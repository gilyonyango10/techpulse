const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { validateSMS, handleValidationErrors, sanitizePhoneNumber } = require('../middleware/validation');
const smsService = require('../services/flexibleSmsService');

const router = express.Router();

// Configure multer for CSV file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 // 1MB limit
  }
});

// Send SMS to multiple recipients
router.post('/send', authenticateToken, validateSMS, handleValidationErrors, async (req, res) => {
  try {
    const { message, recipients } = req.body;
    const userId = req.user.id;
    
    // Sanitize phone numbers
    const sanitizedRecipients = recipients.map(phone => sanitizePhoneNumber(phone));
    
    // Remove duplicates
    const uniqueRecipients = [...new Set(sanitizedRecipients)];
    
    // Send SMS using flexible SMS service
    const result = await smsService.sendSMS(uniqueRecipients, message, userId);
    
    res.json({
      success: true,
      message: 'SMS sending initiated',
      data: result
    });
    
  } catch (error) {
    console.error('SMS sending error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send SMS'
    });
  }
});

// Upload CSV file and send SMS
router.post('/send-csv', authenticateToken, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }
    
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    if (message.length > 160) {
      return res.status(400).json({
        success: false,
        message: 'Message must be 160 characters or less'
      });
    }
    
    const recipients = [];
    const filePath = req.file.path;
    
    // Parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Look for phone number in various possible column names
          const phoneNumber = row.phone || row.phoneNumber || row.phone_number || 
                             row.Phone || row.PhoneNumber || row.mobile || row.number;
          
          if (phoneNumber) {
            try {
              const sanitized = sanitizePhoneNumber(phoneNumber.toString().trim());
              if (sanitized) {
                recipients.push(sanitized);
              }
            } catch (err) {
              console.warn('Invalid phone number in CSV:', phoneNumber);
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid phone numbers found in CSV file'
      });
    }
    
    // Remove duplicates
    const uniqueRecipients = [...new Set(recipients)];
    
    // Check if we have a valid API key, otherwise use mock service
    const useRealAPI = process.env.AFRICASTALKING_API_KEY && 
                      process.env.AFRICASTALKING_API_KEY !== 'your_sandbox_api_key_here';
    
    let result;
    if (useRealAPI) {
      result = await smsService.sendBulkSMS(message, uniqueRecipients, req.user.id);
    } else {
      result = await smsService.sendMockSMS(message, uniqueRecipients, req.user.id);
    }
    
    res.json({
      success: true,
      message: 'SMS sending initiated from CSV',
      data: {
        ...result,
        csvProcessed: true,
        originalCount: recipients.length,
        uniqueCount: uniqueRecipients.length
      }
    });
    
  } catch (error) {
    console.error('CSV SMS sending error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process CSV and send SMS'
    });
  }
});

// Get message history
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const messages = await smsService.getMessageHistory(userId, limit, offset);
    
    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          limit,
          offset,
          count: messages.length
        }
      }
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve messages'
    });
  }
});

// Get detailed message with recipients
router.get('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.id;
    
    if (isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    
    const messageDetails = await smsService.getMessageDetails(messageId, userId);
    
    res.json({
      success: true,
      data: messageDetails
    });
    
  } catch (error) {
    console.error('Get message details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve message details'
    });
  }
});

// Resend failed messages
router.post('/messages/:messageId/resend', authenticateToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.id;
    
    if (isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    
    // Get original message and failed recipients
    const messageDetails = await smsService.getMessageDetails(messageId, userId);
    const failedRecipients = messageDetails.recipients
      .filter(r => r.delivery_status === 'failed')
      .map(r => r.phone_number);
    
    if (failedRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No failed recipients to resend'
      });
    }
    
    // Check if we have a valid API key, otherwise use mock service
    const useRealAPI = process.env.AFRICASTALKING_API_KEY && 
                      process.env.AFRICASTALKING_API_KEY !== 'your_sandbox_api_key_here';
    
    let result;
    if (useRealAPI) {
      result = await smsService.sendBulkSMS(messageDetails.message.message_content, failedRecipients, userId);
    } else {
      result = await smsService.sendMockSMS(messageDetails.message.message_content, failedRecipients, userId);
    }
    
    res.json({
      success: true,
      message: 'Failed messages resent',
      data: {
        ...result,
        resent: true,
        originalMessageId: messageId
      }
    });
    
  } catch (error) {
    console.error('Resend messages error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend messages'
    });
  }
});

module.exports = router;
