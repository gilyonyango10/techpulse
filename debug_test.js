#!/usr/bin/env node

/**
 * Debug Test Script for TextPulse Messaging System
 * Tests the three main debugged features:
 * 1. OTP Verification System
 * 2. Database Schema Compatibility
 * 3. SMS Service Configuration
 */

require('dotenv').config();
const pool = require('./config/database');

const COLORS = {
    GREEN: '\033[32m',
    RED: '\033[31m',
    YELLOW: '\033[33m',
    BLUE: '\033[34m',
    RESET: '\033[0m'
};

function log(level, message) {
    const timestamp = new Date().toISOString();
    const color = COLORS[level] || COLORS.RESET;
    console.log(`${color}[${timestamp}] ${level}: ${message}${COLORS.RESET}`);
}

// Test 1: Database Schema Validation
async function testDatabaseSchema() {
    log('BLUE', '🔍 Testing Database Schema...');
    
    try {
        // Test users table structure
        const usersResult = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        if (usersResult.rows.length === 0) {
            log('YELLOW', '⚠️  Users table not found - run database schema first');
            return false;
        }
        
        const requiredColumns = ['id', 'full_name', 'email', 'phone_number', 'password_hash', 'is_verified'];
        const existingColumns = usersResult.rows.map(row => row.column_name);
        
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length > 0) {
            log('RED', `❌ Missing columns in users table: ${missingColumns.join(', ')}`);
            return false;
        }
        
        // Test OTP table existence
        const otpResult = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name = 'otp_verifications'
        `);
        
        if (otpResult.rows.length === 0) {
            log('RED', '❌ OTP verifications table missing');
            return false;
        }
        
        log('GREEN', '✅ Database schema validation passed');
        return true;
        
    } catch (error) {
        log('RED', `❌ Database schema test failed: ${error.message}`);
        return false;
    }
}

// Test 2: OTP Service Functionality
async function testOTPService() {
    log('BLUE', '🔍 Testing OTP Service...');
    
    try {
        const otpService = require('./services/otpService');
        
        // Test OTP generation
        const otp = otpService.generateOTP();
        if (!/^\d{6}$/.test(otp)) {
            log('RED', '❌ OTP generation failed - invalid format');
            return false;
        }
        
        log('GREEN', `✅ OTP generation working: ${otp}`);
        
        // Test database interaction (without actually sending SMS)
        const testPhone = '+1234567890';
        const testUserId = null; // No user for this test
        
        // Insert test OTP directly
        await pool.query(
            'INSERT INTO otp_verifications (user_id, phone_number, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [testUserId, testPhone, otp, 'test', new Date(Date.now() + 10 * 60 * 1000)]
        );
        
        // Test verification
        const verifyResult = await otpService.verifyOTP(testPhone, otp, 'test');
        
        if (!verifyResult.success) {
            log('RED', `❌ OTP verification failed: ${verifyResult.message}`);
            return false;
        }
        
        // Cleanup
        await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [testPhone]);
        
        log('GREEN', '✅ OTP service functionality verified');
        return true;
        
    } catch (error) {
        log('RED', `❌ OTP service test failed: ${error.message}`);
        return false;
    }
}

// Test 3: SMS Service Configuration
async function testSMSService() {
    log('BLUE', '🔍 Testing SMS Service Configuration...');
    
    try {
        const smsService = require('./services/flexibleSmsService');
        
        // Check provider initialization
        if (!smsService.provider) {
            log('RED', '❌ SMS service provider not initialized');
            return false;
        }
        
        log('GREEN', `✅ SMS provider initialized: ${smsService.provider}`);
        
        // Test mock SMS functionality
        const testRecipients = ['+1234567890'];
        const testMessage = 'Debug test message';
        
        const result = await smsService.sendSMS(testRecipients, testMessage);
        
        if (!result.success) {
            log('RED', '❌ SMS service test failed');
            return false;
        }
        
        if (result.summary.total !== 1) {
            log('RED', '❌ SMS service returned incorrect recipient count');
            return false;
        }
        
        log('GREEN', `✅ SMS service working - Provider: ${result.provider}, Status: ${result.summary.sent}/${result.summary.total} sent`);
        return true;
        
    } catch (error) {
        log('RED', `❌ SMS service test failed: ${error.message}`);
        return false;
    }
}

// Test 4: Route Files Syntax Check
async function testRouteFiles() {
    log('BLUE', '🔍 Testing Route Files...');
    
    try {
        const routes = [
            './routes/auth.js',
            './routes/sms.js',
            './routes/otp.js',
            './routes/contacts.js',
            './routes/templates.js',
            './routes/analytics.js'
        ];
        
        for (const route of routes) {
            try {
                require(route);
                log('GREEN', `✅ ${route} loaded successfully`);
            } catch (error) {
                log('RED', `❌ ${route} failed to load: ${error.message}`);
                return false;
            }
        }
        
        return true;
        
    } catch (error) {
        log('RED', `❌ Route files test failed: ${error.message}`);
        return false;
    }
}

// Test 5: Environment Configuration
function testEnvironmentConfig() {
    log('BLUE', '🔍 Testing Environment Configuration...');
    
    const requiredEnvVars = [
        'DB_HOST',
        'DB_PORT', 
        'DB_NAME',
        'DB_USER',
        'JWT_SECRET'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        log('YELLOW', `⚠️  Missing environment variables: ${missingVars.join(', ')}`);
        log('YELLOW', '   Configure these in your .env file');
    } else {
        log('GREEN', '✅ All required environment variables present');
    }
    
    // Check SMS provider config
    const smsProvider = process.env.SMS_PROVIDER || 'mock';
    log('GREEN', `✅ SMS provider configured: ${smsProvider}`);
    
    if (smsProvider === 'twilio') {
        const twilioVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
        const missingTwilio = twilioVars.filter(varName => !process.env[varName]);
        if (missingTwilio.length > 0) {
            log('YELLOW', `⚠️  Missing Twilio config: ${missingTwilio.join(', ')}`);
        }
    }
    
    if (smsProvider === 'africastalking') {
        const atVars = ['AFRICASTALKING_API_KEY', 'AFRICASTALKING_USERNAME'];
        const missingAT = atVars.filter(varName => !process.env[varName]);
        if (missingAT.length > 0) {
            log('YELLOW', `⚠️  Missing Africa's Talking config: ${missingAT.join(', ')}`);
        }
    }
    
    return missingVars.length === 0;
}

// Main test runner
async function runAllTests() {
    console.log('\n🚀 TextPulse Debug Test Suite');
    console.log('=====================================\n');
    
    const results = {
        envConfig: false,
        routeFiles: false,
        dbSchema: false,
        otpService: false,
        smsService: false
    };
    
    // Test environment configuration first
    results.envConfig = testEnvironmentConfig();
    
    // Test route files
    results.routeFiles = await testRouteFiles();
    
    // Test database-dependent features only if DB is available
    try {
        await pool.query('SELECT 1');
        log('GREEN', '✅ Database connection established');
        
        results.dbSchema = await testDatabaseSchema();
        if (results.dbSchema) {
            results.otpService = await testOTPService();
        }
    } catch (error) {
        log('YELLOW', `⚠️  Database not available: ${error.message}`);
        log('YELLOW', '   Run database setup first: ./setup_enhanced.sh');
    }
    
    // Test SMS service (works without database)
    results.smsService = await testSMSService();
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    const testNames = {
        envConfig: 'Environment Configuration',
        routeFiles: 'Route Files Syntax',
        dbSchema: 'Database Schema',
        otpService: 'OTP Service',
        smsService: 'SMS Service'
    };
    
    let passedTests = 0;
    let totalTests = 0;
    
    for (const [key, name] of Object.entries(testNames)) {
        totalTests++;
        if (results[key]) {
            passedTests++;
            log('GREEN', `✅ ${name}`);
        } else {
            log('RED', `❌ ${name}`);
        }
    }
    
    console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        log('GREEN', '🎉 All tests passed! Your TextPulse system is ready.');
    } else {
        log('YELLOW', '⚠️  Some tests failed. Check the errors above and fix the issues.');
    }
    
    // Cleanup
    await pool.end();
    process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        log('RED', `❌ Test suite failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    testDatabaseSchema,
    testOTPService,
    testSMSService,
    testRouteFiles,
    testEnvironmentConfig
};