// Test script to diagnose the survey call API
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const twilio = require('twilio');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Get Twilio credentials
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Check if Twilio credentials exist
const hasTwilioCredentials = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;
let twilioClient = null;

if (hasTwilioCredentials) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
  console.log('Twilio credentials found. Ready to make calls.');
} else {
  console.log('Twilio credentials not found. Will run in test-only mode.');
}

async function main() {
  console.log('Testing survey call API...');
  
  try {
    // First, find the survey you're using
    const { data: surveys } = await supabase
      .from('surveys')
      .select('*');
      
    console.log('Available surveys:');
    surveys?.forEach((survey, index) => {
      console.log(`- [${index+1}] ${survey.id}: ${survey.name}`);
    });
    
    // Get survey ID from command line or use the first one
    const surveyIdArg = process.argv.find(arg => arg.startsWith('--survey='));
    let testSurveyId;
    
    if (surveyIdArg) {
      const surveyIndex = parseInt(surveyIdArg.split('=')[1]);
      if (!isNaN(surveyIndex) && surveyIndex > 0 && surveyIndex <= surveys.length) {
        testSurveyId = surveys[surveyIndex-1].id;
      } else {
        testSurveyId = surveyIdArg.split('=')[1]; // Consider it a direct ID
      }
    } else {
      testSurveyId = surveys?.[0]?.id;
    }
    
    console.log(`\nUsing test survey ID: ${testSurveyId}`);
    
    // Get survey questions for this survey
    const { data: surveyQuestions, error: sqError } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', testSurveyId);
      
    if (sqError) {
      console.error('Error getting survey questions:', sqError);
      return;
    }
    
    console.log(`\nFound ${surveyQuestions?.length || 0} survey questions for this survey`);
    surveyQuestions?.forEach(sq => {
      console.log(`- ${sq.id}: question_id=${sq.question_id}, order=${sq.order}`);
    });
    
    // Get the question IDs
    const questionIds = surveyQuestions?.map(sq => sq.question_id) || [];
    console.log(`\nQuestion IDs: ${questionIds.join(', ')}`);
    
    // Get the actual questions
    const { data: questionTexts, error: qtError } = await supabase
      .from('questions')
      .select('*')
      .in('id', questionIds);
      
    if (qtError) {
      console.error('Error getting question texts:', qtError);
      return;
    }
    
    console.log(`\nFound ${questionTexts?.length || 0} question texts`);
    
    // Create a map for easier lookup
    const questionMap = {};
    questionTexts?.forEach(q => {
      questionMap[q.id] = q.question_text;
    });
    
    // Show the complete survey with text
    console.log('\nComplete survey with text:');
    surveyQuestions?.sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(sq => {
        const text = questionMap[sq.question_id] || 'MISSING';
        console.log(`${sq.order}: ${text}`);
      });
    
    // Now try a phone list entry
    const { data: phoneEntries } = await supabase
      .from('phone_list')
      .select('*')
      .limit(10);
      
    console.log('\nPhone list entries:');
    phoneEntries?.forEach((phone, index) => {
      console.log(`- [${index+1}] ${phone.id}: ${phone.name} - ${phone.phone_number}`);
    });
    
    // Get phone index from command line or use the first one
    const phoneIdArg = process.argv.find(arg => arg.startsWith('--phone='));
    let selectedPhoneIndex = 0;
    
    if (phoneIdArg) {
      const phoneIndex = parseInt(phoneIdArg.split('=')[1]);
      if (!isNaN(phoneIndex) && phoneIndex > 0 && phoneIndex <= phoneEntries.length) {
        selectedPhoneIndex = phoneIndex - 1;
      }
    }
    
    const testPhoneId = phoneEntries?.[selectedPhoneIndex]?.id;
    const testPhoneNumber = phoneEntries?.[selectedPhoneIndex]?.phone_number;
    const testPersonName = phoneEntries?.[selectedPhoneIndex]?.name;
    
    // Test all pieces together
    console.log('\nSimulating call API with:');
    console.log(`- Survey ID: ${testSurveyId}`);
    console.log(`- Phone ID: ${testPhoneId}`);
    console.log(`- Phone Number: ${testPhoneNumber}`);
    console.log(`- Person Name: ${testPersonName}`);
    
    // Get the survey_questions links
    const { data: links, error: linksError } = await supabase
      .from('survey_questions')
      .select('id, question_id, order')
      .eq('survey_id', testSurveyId);
    
    if (linksError) {
      console.error('Error getting links:', linksError);
      return;
    }
    
    console.log(`Retrieved ${links?.length || 0} question links`);
    
    // Get question IDs
    const qIds = links?.map(link => link.question_id) || [];
    
    // Get question texts
    const { data: texts, error: textsError } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('id', qIds);
    
    if (textsError) {
      console.error('Error getting texts:', textsError);
      return;
    }
    
    console.log(`Retrieved ${texts?.length || 0} question texts`);
    
    // Map texts
    const textMap = {};
    texts?.forEach(t => {
      textMap[t.id] = t.question_text;
    });
    
    // Build final questions with texts
    const finalQuestions = links?.map(link => ({
      id: link.id,
      question_id: link.question_id,
      order: link.order,
      question_text: textMap[link.question_id] || `Missing text for ${link.question_id}`
    })) || [];
    
    // Sort by order
    finalQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    console.log('\nFinal questions (sorted):');
    finalQuestions.forEach(q => {
      console.log(`${q.order}: ${q.question_text}`);
    });
    
    // Combined question text
    const combinedText = finalQuestions.map(q => q.question_text).join('\n\n');
    
    console.log(`\nCombined text length: ${combinedText.length}`);
    console.log(`Combined text: ${combinedText}`);
    
    // Check for ElevenLabs environment variables
    console.log('\nChecking ElevenLabs API key:');
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    console.log(`API key exists: ${!!elevenlabsApiKey}`);
    console.log(`API key starts with: ${elevenlabsApiKey ? elevenlabsApiKey.substring(0, 5) + '...' : 'N/A'}`);
    
    // Now actually initiate a test call if requested
    const shouldInitiateCall = process.argv.includes('--call');
    
    if (shouldInitiateCall) {
      if (!testPhoneNumber) {
        console.error('No phone number available for testing');
        return;
      }
      
      if (!combinedText) {
        console.error('No questions available for testing');
        return;
      }
      
      console.log('\n=== INITIATING ACTUAL TEST CALL ===');
      console.log(`To: ${testPhoneNumber}`);
      console.log(`With: ${finalQuestions.length} questions`);
      
      if (!hasTwilioCredentials) {
        console.error('Cannot initiate call: Twilio credentials not found');
        console.log('To make a call, you need to set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.local');
        return;
      }
      
      // Check if this is a test phone number (+1500555...) which is Twilio's test format
      const isTestPhoneNumber = testPhoneNumber.startsWith('+1500555');
      if (isTestPhoneNumber) {
        console.log('TEST PHONE NUMBER DETECTED. Using mock call instead of real call.');
        console.log('Mock call initiated with SID: TEST_CALL_SID_' + Date.now());
        console.log('To make a real call, use a verified phone number.');
        return;
      }
      
      // Get ElevenLabs flag
      const use11Labs = process.argv.includes('--elevenlabs') || process.argv.includes('--11labs');
      
      // Generate TwiML for the call
      const twiml = generateTestTwiML(combinedText, finalQuestions.length, testPersonName);
      
      try {
        // Make the actual Twilio call
        const call = await twilioClient.calls.create({
          to: testPhoneNumber,
          from: twilioPhoneNumber,
          twiml: twiml,
        });
        
        console.log('\nCall initiated successfully!');
        if (use11Labs) {
          console.log('Using ElevenLabs for voice generation');
        } else {
          console.log('Using standard Twilio TTS');
        }
        console.log(`Call SID: ${call.sid}`);
        console.log('Please answer the phone to test the survey flow');
        
        // Create a record in the call_queue table
        const { data: queueData, error: queueError } = await supabase
          .from('call_queue')
          .insert({
            phone_list_id: testPhoneId,
            survey_id: testSurveyId,
            voice_option: use11Labs ? 'RACHEL' : 'Google.en-US-Wavenet-F',
            language_option: 'en-US',
            status: 'in-progress',
            attempt_count: 1,
            call_sid: call.sid,
            call_status: 'initiated',
            last_attempt_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (queueError) {
          console.error('Error creating call queue entry:', queueError);
        } else {
          console.log('Created call queue entry:', queueData.id);
        }
      } catch (error) {
        console.error('Error initiating Twilio call:', error);
        console.error('Error details:', error.message);
        if (error.code) {
          console.error('Error code:', error.code);
        }
      }
    } else {
      console.log('\nTo initiate an actual test call, run this script with the --call flag');
      console.log('Example: node scripts/test-survey-call.js --call');
      console.log('To select a specific phone number: node scripts/test-survey-call.js --call --phone=2');
      console.log('To use ElevenLabs voice: node scripts/test-survey-call.js --call --phone=2 --elevenlabs');
    }
    
  } catch (e) {
    console.error('Unexpected error:', e);
  }
}

// Helper function to generate TwiML for a test call
function generateTestTwiML(questionText, totalQuestions, personName = '') {
  // Get ElevenLabs flag from command line
  const use11Labs = process.argv.includes('--elevenlabs') || process.argv.includes('--11labs');
  console.log(`Using ElevenLabs voice generation: ${use11Labs ? 'YES' : 'NO'}`);
  
  // Split the questions by paragraph to get an array
  const questions = questionText.split('\n\n').filter(q => q.trim());
  const voiceOption = 'Google.en-US-Wavenet-F'; // Google WaveNet female voice

  // If using ElevenLabs, generate a different TwiML with Play tags for audio
  if (use11Labs) {
    // In a real implementation, we would generate audio URLs here
    // For testing, we'll construct TwiML that indicates ElevenLabs would be used
    // and points to the API that would handle ElevenLabs audio
    
    let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
    twiml += '<Response>';
    
    // Instead of Say tags, we would use Play tags pointing to ElevenLabs audio URLs
    // For testing, we'll use Say tags with an indicator
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] Hello${personName ? ' ' + personName : ''}.</Say>`;
    twiml += '<Pause length="0.5"/>';
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] This is an AI research assistant calling about a healthcare survey.</Say>`;
    twiml += '<Pause length="0.5"/>';
    
    let introText = "I'd like to ask you a few quick questions about your healthcare experience. ";
    introText += "Your feedback will really help improve services in your area. Is that okay?";
    
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] ${introText}</Say>`;
    twiml += '<Pause length="1.5"/>';
    
    // The first question
    const firstQuestion = questions[0] || "How satisfied are you with your healthcare provider on a scale from 1 to 5?";
    
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] Great. First question...</Say>`;
    twiml += '<Pause length="0.5"/>';
    twiml += `<Gather input="dtmf speech" timeout="10" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;use11labs=true&amp;callSid={{call_sid}}" method="POST">`;
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] ${firstQuestion}</Say>`;
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] Just let me know your answer after the tone.</Say>`;
    twiml += '</Gather>';
    
    // Repeat with follow-up
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] I'm sorry, I didn't catch that. Let me ask again.</Say>`;
    twiml += '<Pause length="0.5"/>';
    twiml += `<Gather input="dtmf speech" timeout="10" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;use11labs=true&amp;callSid={{call_sid}}" method="POST">`;
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] ${firstQuestion}</Say>`;
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] You can respond with your voice or press a key on your phone.</Say>`;
    twiml += '</Gather>';
    
    // Goodbye
    twiml += `<Say voice="${voiceOption}">[ElevenLabs would say] No problem. Thank you for your time. I'll try to reach you another time. Have a great day!</Say>`;
    twiml += '</Response>';
    
    return twiml;
  }
  
  // Otherwise, use standard Twilio TTS
  let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
  twiml += '<Response>';
  
  // A more natural greeting with subtle pauses to simulate thinking
  twiml += `<Say voice="${voiceOption}">Hello${personName ? ' ' + personName : ''}.</Say>`;
  twiml += '<Pause length="0.5"/>';
  twiml += `<Say voice="${voiceOption}">This is an AI research assistant calling about a healthcare survey.</Say>`;
  twiml += '<Pause length="0.5"/>';
  
  // More conversational intro with prosody
  let introText = "I'd like to ask you a few quick questions about your healthcare experience. ";
  introText += "Your feedback will really help improve services in your area. Is that okay?";
  
  twiml += `<Say voice="${voiceOption}">${introText}</Say>`;
  twiml += '<Pause length="1.5"/>';
  
  // Add the first question with more conversational framing
  const firstQuestion = questions[0] || "How satisfied are you with your healthcare provider on a scale from 1 to 5?";
  
  twiml += `<Say voice="${voiceOption}">Great. First question...</Say>`;
  twiml += '<Pause length="0.5"/>';
  twiml += `<Gather input="dtmf speech" timeout="10" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;callSid={{call_sid}}" method="POST">`;
  twiml += `<Say voice="${voiceOption}">${firstQuestion}</Say>`;
  twiml += `<Say voice="${voiceOption}">Just let me know your answer after the tone.</Say>`;
  twiml += '</Gather>';
  
  // If no response, repeat with a more natural follow-up
  twiml += `<Say voice="${voiceOption}">I'm sorry, I didn't catch that. Let me ask again.</Say>`;
  twiml += '<Pause length="0.5"/>';
  twiml += `<Gather input="dtmf speech" timeout="10" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;callSid={{call_sid}}" method="POST">`;
  twiml += `<Say voice="${voiceOption}">${firstQuestion}</Say>`;
  twiml += `<Say voice="${voiceOption}">You can respond with your voice or press a key on your phone.</Say>`;
  twiml += '</Gather>';
  
  // Friendly goodbye
  twiml += `<Say voice="${voiceOption}">No problem. Thank you for your time. I'll try to reach you another time. Have a great day!</Say>`;
  twiml += '</Response>';
  
  return twiml;
}

main()
  .catch(err => {
    console.error('Top-level error:', err);
  })
  .finally(() => {
    console.log('Test completed');
  }); 