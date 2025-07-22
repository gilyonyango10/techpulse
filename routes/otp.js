const express = require('express');
const { body, validationResult } = require('express-validator');
const otpService = require('../services/otpService');
const pool = require('../config/database');
const router = express.Router();

// Validation middleware
const validateOTPRequest = [
  body('phoneNumber')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('purpose')
    .isIn(['registration', 'login', 'password_reset'])
    .withMessage('Invalid purpose')
];

const validateOTPVerification = [
  body('phoneNumber')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 6 digits'),
  body('purpose')
    .isIn(['registration', 'login', 'password_reset'])
    .withMessage('Invalid purpose')
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }))
    });
  }
  next();
};

// Send OTP
router.post('/send', validateOTPRequest, handleValidationErrors, async (req, res) => {
  try {
    const { phoneNumber, purpose } = req.body;
    let userId = null;

    // For login/password reset, check if user exists
    if (purpose === 'login' || purpose === 'password_reset') {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE phone_number = $1',
        [phoneNumber]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No account found with this phone number'
        });
      }
      
      userId = userResult.rows[0].id;
    }

    const result = await otpService.sendOTP(phoneNumber, purpose, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// Verify OTP
router.post('/verify', validateOTPVerification, handleValidationErrors, async (req, res) => {
  try {
    const { phoneNumber, otp, purpose } = req.body;
    
    const result = await otpService.verifyOTP(phoneNumber, otp, purpose);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

module.exports = router;
