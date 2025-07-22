const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { validateRegistration, validateLogin, handleValidationErrors } = require('../middleware/validation');
const otpService = require('../services/otpService');
const { body } = require('express-validator');

const router = express.Router();

// Step 1: Initial Registration (sends OTP)
router.post('/register', validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone_number = $2',
      [email, phoneNumber]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone number already exists'
      });
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Store user data temporarily (not verified yet)
    const tempUserResult = await pool.query(
      'INSERT INTO users (full_name, email, phone_number, password_hash, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [fullName, email, phoneNumber, passwordHash, false]
    );
    
    const userId = tempUserResult.rows[0].id;
    
    // Send OTP for phone verification
    try {
      await otpService.sendOTP(phoneNumber, 'registration', userId);
      
      res.status(200).json({
        success: true,
        message: 'Registration initiated. Please verify your phone number with the OTP sent via SMS.',
        data: {
          userId,
          phoneNumber,
          nextStep: 'verify-otp'
        }
      });
    } catch (otpError) {
      // If OTP sending fails, remove the temporary user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// Step 2: Complete Registration (verify OTP)
router.post('/verify-registration', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }
    
    // Verify OTP
    const otpResult = await otpService.verifyOTP(phoneNumber, otp, 'registration');
    
    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }
    
    // Find the unverified user
    const userResult = await pool.query(
      'SELECT id, full_name, email, phone_number, created_at FROM users WHERE phone_number = $1 AND is_verified = false',
      [phoneNumber]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already verified'
      });
    }
    
    const user = userResult.rows[0];
    
    // Mark user as verified
    await pool.query(
      'UPDATE users SET is_verified = true WHERE id = $1',
      [user.id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
          createdAt: user.created_at,
          isVerified: true
        },
        token
      }
    });
    
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during verification'
    });
  }
});

// User Login
router.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const result = await pool.query(
      'SELECT id, full_name, email, phone_number, password_hash, is_verified FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check if user is verified
    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your phone number to complete registration',
        data: {
          phoneNumber: user.phone_number,
          nextStep: 'verify-otp'
        }
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number
        },
        token
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// Get current user profile
router.get('/profile', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ==============================
// Password Reset - Step 1: Request reset code
// ==============================
router.post('/request-password-reset', [
  body('phoneNumber')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
], handleValidationErrors, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Check if user exists
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

    const userId = userResult.rows[0].id;

    // Send OTP for password reset
    await otpService.sendOTP(phoneNumber, 'password_reset', userId);

    res.json({
      success: true,
      message: 'Password reset code sent via SMS',
      data: {
        phoneNumber,
        nextStep: 'verify-reset-code'
      }
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate password reset'
    });
  }
});

// ==============================
// Password Reset - Step 2: Verify code & set new password
// ==============================
router.post('/reset-password', [
  body('phoneNumber')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 6 digits'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
], handleValidationErrors, async (req, res) => {
  try {
    const { phoneNumber, otp, newPassword } = req.body;

    // Verify OTP
    const otpResult = await otpService.verifyOTP(phoneNumber, otp, 'password_reset');
    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in DB
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE phone_number = $2',
      [passwordHash, phoneNumber]
    );

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

module.exports = router;
