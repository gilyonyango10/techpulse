// Quick SMS test script
require('dotenv').config();
const smsService = require('./services/flexibleSmsService');

async function testSMS() {
  try {
    console.log('🧪 Testing SMS service...');
    console.log('📱 Provider:', process.env.SMS_PROVIDER);
    
    // Test with a safe test number (your Twilio number)
    const testNumber = '+18777804236'; // Your Twilio number
    const testMessage = 'Hello from TextPulse! SMS service is working 🎉';
    
    console.log(`📤 Sending test SMS to ${testNumber}...`);
    
    const result = await smsService.sendSMS([testNumber], testMessage);
    
    console.log('✅ SMS Test Results:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.summary.sent > 0) {
      console.log('🎉 SMS service is working perfectly!');
    } else {
      console.log('❌ SMS test failed');
    }
    
  } catch (error) {
    console.error('❌ SMS test error:', error.message);
  }
}

testSMS();
