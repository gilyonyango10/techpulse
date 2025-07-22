const pool = require('../config/database');
const smsService = require('./flexibleSmsService');

class OTPService {
  // Generate 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP via SMS
  async sendOTP(phoneNumber, purpose, userId = null) {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in database
      await pool.query(
        'INSERT INTO otp_verifications (user_id, phone_number, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [userId, phoneNumber, otp, purpose, expiresAt]
      );

      // Send SMS
      const message = `Your TextPulse verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
      
      const result = await smsService.sendSMS([phoneNumber], message);
      
      return {
        success: true,
        message: 'OTP sent successfully',
        expiresAt
      };
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw new Error('Failed to send OTP');
    }
  }

  // Verify OTP
  async verifyOTP(phoneNumber, otp, purpose) {
    try {
      const result = await pool.query(
        `SELECT id, user_id, attempts, expires_at 
         FROM otp_verifications 
         WHERE phone_number = $1 AND otp_code = $2 AND purpose = $3 
         AND is_verified = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [phoneNumber, otp, purpose]
      );

      if (result.rows.length === 0) {
        // Check if OTP exists but is expired or invalid
        const expiredCheck = await pool.query(
          `SELECT id, attempts FROM otp_verifications 
           WHERE phone_number = $1 AND purpose = $2 
           ORDER BY created_at DESC LIMIT 1`,
          [phoneNumber, purpose]
        );

        if (expiredCheck.rows.length > 0) {
          // Increment attempts
          await pool.query(
            'UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1',
            [expiredCheck.rows[0].id]
          );
        }

        return {
          success: false,
          message: 'Invalid or expired OTP'
        };
      }

      const otpRecord = result.rows[0];

      // Check attempts limit
      if (otpRecord.attempts >= 3) {
        return {
          success: false,
          message: 'Too many failed attempts. Please request a new OTP.'
        };
      }

      // Mark as verified
      await pool.query(
        'UPDATE otp_verifications SET is_verified = TRUE WHERE id = $1',
        [otpRecord.id]
      );

      // Update user verification status if applicable
      if (otpRecord.user_id) {
        await pool.query(
          'UPDATE users SET phone_verified = TRUE WHERE id = $1',
          [otpRecord.user_id]
        );
      }

      return {
        success: true,
        message: 'OTP verified successfully',
        userId: otpRecord.user_id
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw new Error('Failed to verify OTP');
    }
  }

  // Clean expired OTPs (run periodically)
  async cleanExpiredOTPs() {
    try {
      await pool.query('DELETE FROM otp_verifications WHERE expires_at < NOW()');
    } catch (error) {
      console.error('Error cleaning expired OTPs:', error);
    }
  }
}

module.exports = new OTPService();
