// Simple script to test Twilio call functionality without relying on audio files
const twilio = require('twilio');
require('dotenv').config({ path: '.env.local' });

// Get Twilio credentials
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Check required credentials
if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
  console.error('Error: Twilio credentials not found in .env.local file');
  console.error('Make sure you have set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER');
  process.exit(1);
}

// Initialize Twilio client
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// Get the phone number to call from command line args
const phoneArg = process.argv[2];
if (!phoneArg) {
  console.error('Error: No phone number provided');
  console.error('Usage: node scripts/twilio-test-call.js +1234567890');
  process.exit(1);
}

// Generate a simple TwiML document with just text-to-speech
function generateSimpleTwiML() {
  // Use Google WaveNet voice for better quality
  const voiceOption = 'Google.en-US-Wavenet-F';
  
  let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
  twiml += '<Response>';
  
  twiml += `<Say voice="${voiceOption}">Hello. This is a test call from the AI research assistant.</Say>`;
  twiml += '<Pause length="1"/>';
  
  twiml += `<Say voice="${voiceOption}">I would like to ask you a few questions about your healthcare experience.</Say>`;
  twiml += '<Pause length="1"/>';
  
  twiml += `<Gather input="dtmf speech" timeout="10" action="https://demo.twilio.com/welcome/voice/" method="POST">`;
  twiml += `<Say voice="${voiceOption}">How satisfied are you with your healthcare provider on a scale from 1 to 5, with 5 being very satisfied?</Say>`;
  twiml += `<Say voice="${voiceOption}">Please answer after the tone.</Say>`;
  twiml += '</Gather>';
  
  twiml += `<Say voice="${voiceOption}">I didn't catch that. Thank you for your time. Goodbye.</Say>`;
  twiml += '</Response>';
  
  return twiml;
}

// Make the test call
async function makeTestCall() {
  const phoneNumber = phoneArg;
  const twiml = generateSimpleTwiML();
  
  console.log(`Making test call to ${phoneNumber}`);
  console.log(`Using Twilio number: ${twilioPhoneNumber}`);
  
  try {
    const call = await twilioClient.calls.create({
      twiml: twiml,
      to: phoneNumber,
      from: twilioPhoneNumber
    });
    
    console.log('Call initiated successfully!');
    console.log(`Call SID: ${call.sid}`);
    console.log('Please answer your phone to test the call flow.');
    
  } catch (error) {
    console.error('Error making call:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
      
      if (error.code === 21219) {
        console.error('This phone number is not verified with your Twilio trial account.');
        console.error('For trial accounts, you need to verify the recipient\'s phone number first.');
        console.error('Go to: https://www.twilio.com/console/phone-numbers/verified');
      } else if (error.code === 21212) {
        console.error('Invalid phone number format.');
        console.error('Make sure the phone number includes the country code (e.g., +12345678901)');
      }
    }
  }
}

// Run the test
makeTestCall(); 