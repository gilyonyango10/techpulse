const { body, validationResult } = require('express-validator');

// Validation rules for user registration
const validateRegistration = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Full name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phoneNumber')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// Validation rules for user login
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Validation rules for SMS sending
const validateSMS = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 160 })
    .withMessage('Message must be between 1 and 160 characters'),
  
  body('recipients')
    .isArray({ min: 1 })
    .withMessage('At least one recipient is required'),
  
  body('recipients.*')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('All phone numbers must be valid')
];

// Middleware to handle validation errors
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

// Phone number sanitization
const sanitizePhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If number doesn't start with +, add country code (assuming Kenya +254)
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+254' + cleaned.substring(1);
    } else if (cleaned.startsWith('254')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+254' + cleaned;
    }
  }
  
  return cleaned;
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateSMS,
  handleValidationErrors,
  sanitizePhoneNumber
};
