// Test script for ElevenLabs voice integration with Twilio calls
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

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

// Get ElevenLabs API key
const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;

// Check required credentials
const hasTwilioCredentials = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;
const hasElevenlabsCredentials = elevenlabsApiKey;

// Voice options for ElevenLabs
const VOICE_OPTIONS = {
  RACHEL: 'EXAVITQu4vr4xnSDxMaL', // Rachel - warm, natural female voice
  ADAM: '29vD33N1CtxCmqQRPOHJ', // Adam - authoritative male voice
  ANTONI: 'ErXwobaYiN019PkySvjV', // Antoni - crisp male voice
  JOSH: 'TxGEqnHWrfWFTfGW9XjX', // Josh - deep male voice
  ELLI: 'MF3mGyEYCl7XYWbV9V6O', // Elli - approachable female voice
  DOMI: 'AZnzlk1XvdvUeBnXmlld', // Domi - female American professional
  BELLA: 'EXAVITQu4vr4xnSDxMaL', // Bella - natural female voice
  CALLUM: 'N2lVS1w4EtoT3dr4eOWO', // Callum - British male voice
};

// Initialize Twilio client if credentials exist
let twilioClient = null;
if (hasTwilioCredentials) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
  console.log('Twilio credentials found. Ready to make calls.');
} else {
  console.log('Twilio credentials not found. Will run in test-only mode.');
}

// Create audio directory if it doesn't exist
const audioDir = path.join(__dirname, '../public/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log(`Created audio directory: ${audioDir}`);
}

// Get the base URL from environment or use localhost
const baseUrl = process.env.VERCEL_URL || process.env.BASE_URL || 'http://localhost:3000';

// Create Express app for serving audio files
const app = express();
const port = 3000;
let server = null;

// Function to start the audio server
function startAudioServer() {
  // Ensure the server isn't already running
  if (server) {
    console.log('Audio server already running');
    return;
  }
  
  // Serve static files from the public directory
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Add simple logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
  
  // Add a route for the Twilio response webhook
  app.post('/api/twilio/response', express.urlencoded({ extended: true }), async (req, res) => {
    console.log('Received response from Twilio:');
    console.log('- Body:', req.body);
    console.log('- Query:', req.query);
    
    // Get question number and total from query params
    const questionNum = parseInt(req.query.question) || 1;
    const totalQuestions = parseInt(req.query.totalQuestions) || 1;
    const callSid = req.query.callSid || req.body.CallSid;
    const userResponse = req.body.SpeechResult || req.body.Digits || 'No response';
    
    console.log(`Response for question ${questionNum}/${totalQuestions}: "${userResponse}"`);
    
    // Save the response to the database
    if (callSid) {
      try {
        // Find the call queue entry
        const { data: queueEntry, error: queueError } = await supabase
          .from('call_queue')
          .select('id, phone_list_id, survey_id, responses')
          .eq('call_sid', callSid)
          .single();
          
        if (queueError) {
          console.error('Error finding call queue entry:', queueError);
        } else if (queueEntry) {
          console.log('Found call queue entry:', queueEntry.id);
          
          // Get the current survey question
          const { data: surveyQuestions, error: sqError } = await supabase
            .from('survey_questions')
            .select('id, question_id, order')
            .eq('survey_id', queueEntry.survey_id)
            .order('order');
            
          if (sqError) {
            console.error('Error fetching survey questions:', sqError);
          } else if (surveyQuestions && surveyQuestions.length > 0) {
            // Find the current question
            const currentQuestion = surveyQuestions.find(q => q.order === questionNum);
            
            if (currentQuestion) {
              console.log('Saving response for question:', currentQuestion.question_id);
              
              // Save the response to the responses table
              const { error: responseError } = await supabase
                .from('responses')
                .insert({
                  phone_list_id: queueEntry.phone_list_id,
                  question_id: currentQuestion.question_id,
                  answer_text: userResponse,
                  call_sid: callSid
                });
                
              if (responseError) {
                console.error('Error saving response:', responseError);
              } else {
                console.log('Response saved successfully to database!');
              }
              
              // Update the call queue entry with the response
              const existingResponses = queueEntry.responses || {};
              const updatedResponses = {
                ...existingResponses,
                [currentQuestion.question_id]: userResponse
              };
              
              const { error: updateError } = await supabase
                .from('call_queue')
                .update({
                  responses: updatedResponses
                })
                .eq('id', queueEntry.id);
                
              if (updateError) {
                console.error('Error updating call queue with response:', updateError);
              } else {
                console.log('Call queue entry updated with response');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error saving response to database:', error);
      }
    }
    
    // If it's the last question, say thank you and hang up
    if (questionNum >= totalQuestions) {
      // Update the call status to completed
      if (callSid) {
        try {
          const { error: updateError } = await supabase
            .from('call_queue')
            .update({
              status: 'completed',
              call_status: 'completed'
            })
            .eq('call_sid', callSid);
            
          if (updateError) {
            console.error('Error updating call status to completed:', updateError);
          } else {
            console.log('Call marked as completed in database');
          }
        } catch (error) {
          console.error('Error updating call status:', error);
        }
      }
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for completing our survey. Your feedback is valuable to us. Have a great day!</Say>
  <Hangup />
</Response>`;
      res.type('text/xml');
      res.send(twiml);
      return;
    }
    
    // Otherwise, get the next question
    const nextQuestionNum = questionNum + 1;
    
    // Try to get the text of the next question
    let nextQuestionText = `Question ${nextQuestionNum} of ${totalQuestions}`;
    
    if (callSid) {
      try {
        // Get the survey ID from the call queue
        const { data: callData } = await supabase
          .from('call_queue')
          .select('survey_id')
          .eq('call_sid', callSid)
          .single();
          
        if (callData) {
          // Get the survey questions
          const { data: surveyQuestions } = await supabase
            .from('survey_questions')
            .select('question_id, order')
            .eq('survey_id', callData.survey_id)
            .order('order');
            
          if (surveyQuestions) {
            // Find the next question
            const nextQuestion = surveyQuestions.find(q => q.order === nextQuestionNum);
            
            if (nextQuestion) {
              // Get the question text
              const { data: questionData } = await supabase
                .from('questions')
                .select('question_text')
                .eq('id', nextQuestion.question_id)
                .single();
                
              if (questionData) {
                nextQuestionText = questionData.question_text;
                console.log(`Next question text: ${nextQuestionText}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error getting next question text:', error);
      }
    }
    
    // Simple thank you and next question
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for your answer.</Say>
  <Pause length="0.5"/>
  <Say>Next question...</Say>
  <Gather input="dtmf speech" timeout="10" action="/api/twilio/response?question=${nextQuestionNum}&amp;totalQuestions=${totalQuestions}&amp;callSid=${callSid}" method="POST">
    <Say>${nextQuestionText}</Say>
    <Say>Please answer after the tone.</Say>
  </Gather>
</Response>`;
    
    res.type('text/xml');
    res.send(twiml);
  });
  
  // Start the server
  server = app.listen(port, () => {
    console.log(`Audio server listening at http://localhost:${port}`);
    console.log(`Audio files served from: ${audioDir}`);
  });
  
  return server;
}

// Function to stop the audio server
function stopAudioServer() {
  if (server) {
    server.close();
    server = null;
    console.log('Audio server stopped');
  }
}

/**
 * Generate a unique filename for an audio file based on content and parameters
 */
function generateAudioFilename(text, voiceId) {
  // Create a hash of the text content to use in the filename
  const contentHash = crypto
    .createHash('md5')
    .update(text)
    .digest('hex')
    .substring(0, 10);
    
  return `${voiceId}_${contentHash}.mp3`;
}

/**
 * Generate audio from text using ElevenLabs API
 */
async function generateAudio(
  text,
  voiceId = VOICE_OPTIONS.RACHEL,
  stability = 0.5,
  similarityBoost = 0.7
) {
  if (!elevenlabsApiKey) {
    console.error('ELEVENLABS_API_KEY is not set.');
    throw new Error('ELEVENLABS_API_KEY is required');
  }
  
  // Trim and clean text
  const cleanedText = text.trim();
  if (!cleanedText) {
    console.warn('Empty text provided to ElevenLabs API');
    throw new Error('Text content is required');
  }
  
  try {
    // Generate a unique filename
    const filename = generateAudioFilename(cleanedText, voiceId);
    const filePath = path.join(audioDir, filename);
    
    // Check if the file already exists
    if (fs.existsSync(filePath)) {
      console.log(`Using existing audio file: ${filename}`);
      return {
        filename,
        filePath,
        publicUrl: `${baseUrl}/audio/${filename}`
      };
    }
    
    console.log(`Generating new audio with ElevenLabs for: "${cleanedText.substring(0, 50)}..."${cleanedText.length > 50 ? '...' : ''}`);
    console.log(`Using voice ID: ${voiceId}`);
    
    // Make API call to ElevenLabs
    console.log('Sending request to ElevenLabs API...');
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenlabsApiKey,
        },
        body: JSON.stringify({
          text: cleanedText,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        }),
      }
    );
    
    // Handle API errors
    if (!response.ok) {
      const statusCode = response.status;
      let errorMessage = `ElevenLabs API error: ${statusCode}`;
      let errorDetails = '';
      
      try {
        const errorData = await response.json();
        errorDetails = JSON.stringify(errorData);
        console.error('ElevenLabs API error details:', errorData);
      } catch {
        errorDetails = await response.text();
        console.error('ElevenLabs API error response:', errorDetails);
      }
      
      throw new Error(`${errorMessage}: ${errorDetails.slice(0, 100)}`);
    }
    
    console.log('Successfully received audio from ElevenLabs API');
    
    // Get audio binary data
    const audioBuffer = await response.arrayBuffer();
    const audioSize = audioBuffer.byteLength;
    console.log(`Audio size: ${audioSize} bytes`);
    
    if (audioSize < 100) {
      console.error('Received suspiciously small audio file from ElevenLabs');
      throw new Error('Invalid audio data received from ElevenLabs API');
    }
    
    // Save audio file to disk
    fs.writeFileSync(filePath, Buffer.from(audioBuffer));
    console.log(`Audio file saved to: ${filePath}`);
    
    // Return the file information
    return {
      filename,
      filePath,
      publicUrl: `${baseUrl}/audio/${filename}`
    };
  } catch (error) {
    console.error('Error generating audio:', error);
    throw error;
  }
}

/**
 * Prepare multiple audio files for a call script
 */
async function prepareCallScript(textSegments, voiceId = VOICE_OPTIONS.RACHEL) {
  try {
    const audioInfo = [];
    
    // Process each segment in sequence
    for (const text of textSegments) {
      if (text.trim()) {
        const info = await generateAudio(text, voiceId);
        audioInfo.push(info);
      }
    }
    
    return audioInfo;
  } catch (error) {
    console.error('Error preparing call script:', error);
    throw error;
  }
}

/**
 * Generate TwiML with audio files
 */
function generateTwiMLWithAudio(audioInfo, totalQuestions, personName = '') {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
  twiml += '<Response>';
  
  // Play greeting (index 0)
  if (audioInfo.length > 0) {
    twiml += `<Play>${audioInfo[0].publicUrl}</Play>`;
  }
  
  // Play introduction (index 1)
  if (audioInfo.length > 1) {
    twiml += `<Play>${audioInfo[1].publicUrl}</Play>`;
  }
  
  // Play transition to first question (index 2)
  if (audioInfo.length > 2) {
    twiml += `<Play>${audioInfo[2].publicUrl}</Play>`;
  }
  
  // Gather for first question (index 3)
  if (audioInfo.length > 3) {
    twiml += `<Gather input="dtmf speech" timeout="10" action="${baseUrl}/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;use11labs=true&amp;callSid={{call_sid}}" method="POST">`;
    // Play the first question
    twiml += `<Play>${audioInfo[3].publicUrl}</Play>`;
    
    // Play the response prompt
    if (audioInfo.length > 4) {
      twiml += `<Play>${audioInfo[4].publicUrl}</Play>`;
    }
    twiml += '</Gather>';
    
    // If no response, play the "I didn't catch that" message
    if (audioInfo.length > 5) {
      twiml += `<Play>${audioInfo[5].publicUrl}</Play>`;
    }
    
    // Ask the question again
    twiml += `<Gather input="dtmf speech" timeout="10" action="${baseUrl}/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;use11labs=true&amp;callSid={{call_sid}}" method="POST">`;
    twiml += `<Play>${audioInfo[3].publicUrl}</Play>`; // Question again
    
    // Play response prompt again
    if (audioInfo.length > 4) {
      twiml += `<Play>${audioInfo[4].publicUrl}</Play>`;
    }
    twiml += '</Gather>';
  }
  
  // Play goodbye message (index 6)
  if (audioInfo.length > 6) {
    twiml += `<Play>${audioInfo[6].publicUrl}</Play>`;
  }
  
  twiml += '</Response>';
  
  // Log the TwiML for debugging
  console.log('\nGenerated TwiML:');
  console.log(twiml);
  
  return twiml;
}

/**
 * Create conversational script segments
 */
function createConversationalScript(questionText, surveyDescription = '', personName = '') {
  // Split questions into an array
  const questions = questionText.split('\n\n').filter(q => q.trim());
  const scriptSegments = [];
  
  // Create greeting
  const greeting = `Hello${personName ? ' ' + personName : ''}. This is an AI research assistant calling about a healthcare survey.`;
  scriptSegments.push(greeting);
  
  // Create introduction
  let intro = "I'd like to ask you a few quick questions about your healthcare experience. ";
  if (surveyDescription && surveyDescription.trim()) {
    intro += `${surveyDescription.trim()} `;
  }
  intro += "Your feedback will really help improve services in your area. Is that okay?";
  scriptSegments.push(intro);
  
  // Add a transition to first question
  const transition = "Great. First question...";
  scriptSegments.push(transition);
  
  // Add the first question
  if (questions.length > 0) {
    scriptSegments.push(questions[0]);
  } else {
    scriptSegments.push("How satisfied are you with your healthcare provider on a scale from 1 to 5?");
  }
  
  // Add response prompt
  scriptSegments.push("Just let me know your answer after the tone.");
  
  // Add repeat prompt if no response
  scriptSegments.push("I'm sorry, I didn't catch that. Let me ask again.");
  
  // Add goodbye
  scriptSegments.push("No problem. Thank you for your time. I'll try to reach you another time. Have a great day!");
  
  return scriptSegments;
}

async function main() {
  console.log('Testing ElevenLabs voice integration with Twilio...');
  
  // Start the audio server at the beginning
  startAudioServer();
  
  if (!hasElevenlabsCredentials) {
    console.error('ElevenLabs API key not found. Set ELEVENLABS_API_KEY in .env.local');
    process.exit(1);
  }
  
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
    
    // Get survey info
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', testSurveyId)
      .single();
      
    if (surveyError) {
      console.error('Error getting survey data:', surveyError);
      return;
    }
    
    // Get survey questions
    const { data: surveyQuestions, error: sqError } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', testSurveyId)
      .order('order');
      
    if (sqError) {
      console.error('Error getting survey questions:', sqError);
      return;
    }
    
    console.log(`\nFound ${surveyQuestions?.length || 0} survey questions for this survey`);
    
    // Get the question IDs
    const questionIds = surveyQuestions?.map(sq => sq.question_id) || [];
    
    // Get the actual questions
    const { data: questionTexts, error: qtError } = await supabase
      .from('questions')
      .select('*')
      .in('id', questionIds);
      
    if (qtError) {
      console.error('Error getting question texts:', qtError);
      return;
    }
    
    // Create a map for easier lookup
    const questionMap = {};
    questionTexts?.forEach(q => {
      questionMap[q.id] = q.question_text;
    });
    
    // Show the complete survey with text
    console.log('\nComplete survey with text:');
    surveyQuestions?.forEach(sq => {
      const text = questionMap[sq.question_id] || 'MISSING';
      console.log(`${sq.order}: ${text}`);
    });
    
    // Get phone list entries
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
    
    console.log('\nUsing:');
    console.log(`- Phone: ${testPersonName} - ${testPhoneNumber}`);
    
    // Get ElevenLabs voice to use
    const voiceIdArg = process.argv.find(arg => arg.startsWith('--voice='));
    let voiceId = VOICE_OPTIONS.RACHEL; // Default to Rachel
    
    if (voiceIdArg) {
      const voiceName = voiceIdArg.split('=')[1].toUpperCase();
      if (VOICE_OPTIONS[voiceName]) {
        voiceId = VOICE_OPTIONS[voiceName];
        console.log(`Using voice: ${voiceName}`);
      } else {
        console.log(`Voice ${voiceName} not found. Using default (Rachel).`);
      }
    } else {
      console.log('Using default voice: RACHEL');
    }
    
    // Build combined question text
    const combinedQuestionText = surveyQuestions?.map(sq => 
      questionMap[sq.question_id] || `Missing text for ${sq.question_id}`
    ).join('\n\n');
    
    // Create the script segments
    const scriptSegments = createConversationalScript(
      combinedQuestionText,
      surveyData.description || '',
      testPersonName
    );
    
    console.log('\nScript segments:');
    scriptSegments.forEach((segment, index) => {
      console.log(`${index + 1}: ${segment.substring(0, 50)}${segment.length > 50 ? '...' : ''}`);
    });
    
    // The actual call test
    const shouldInitiateCall = process.argv.includes('--call');
    
    if (shouldInitiateCall) {
      if (!hasTwilioCredentials) {
        console.error('Cannot initiate call: Twilio credentials not found');
        console.log('To make a call, you need to set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.local');
        return;
      }
      
      if (!testPhoneNumber) {
        console.error('No phone number available for testing');
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
      
      console.log('\n=== GENERATING AUDIO FILES ===');
      
      // Generate audio files for the script segments
      const audioInfo = await prepareCallScript(scriptSegments, voiceId);
      console.log(`Generated ${audioInfo.length} audio files`);
      
      // Create TwiML with the audio files
      const twiml = generateTwiMLWithAudio(
        audioInfo,
        surveyQuestions.length,
        testPersonName
      );
      
      console.log('\n=== INITIATING CALL WITH ELEVENLABS AUDIO ===');
      console.log(`To: ${testPhoneNumber}`);
      
      try {
        // Make the call
        console.log('Preparing to make Twilio call with these parameters:');
        console.log(`- To: ${testPhoneNumber}`);
        console.log(`- From: ${twilioPhoneNumber}`);
        console.log(`- TwiML length: ${twiml.length} characters`);
        
        const call = await twilioClient.calls.create({
          to: testPhoneNumber,
          from: twilioPhoneNumber,
          twiml: twiml,
        });
        
        console.log('\nCall initiated successfully!');
        console.log(`Call SID: ${call.sid}`);
        console.log('Please answer the phone to test the survey flow with ElevenLabs voices');
        
        // Create or update a record in the call_queue table
        // First, check if there's an existing entry for this phone and survey
        const { data: existingEntries, error: existingError } = await supabase
          .from('call_queue')
          .select('*')
          .eq('phone_list_id', testPhoneId)
          .eq('survey_id', testSurveyId);
          
        if (existingError) {
          console.error('Error checking for existing call queue entries:', existingError);
        }
        
        if (existingEntries && existingEntries.length > 0) {
          // Update the existing entry
          const existingEntry = existingEntries[0];
          console.log(`Found existing call queue entry: ${existingEntry.id}`);
          console.log(`Updating attempt count from ${existingEntry.attempt_count} to ${existingEntry.attempt_count + 1}`);
          
          const { data: updateData, error: updateError } = await supabase
            .from('call_queue')
            .update({
              attempt_count: existingEntry.attempt_count + 1,
              call_sid: call.sid,
              call_status: 'initiated',
              last_attempt_at: new Date().toISOString(),
              voice_option: 'ELEVENLABS_' + Object.keys(VOICE_OPTIONS).find(key => VOICE_OPTIONS[key] === voiceId) || 'RACHEL',
            })
            .eq('id', existingEntry.id)
            .select()
            .single();
            
          if (updateError) {
            console.error('Error updating call queue entry:', updateError);
          } else {
            console.log('Updated call queue entry:', updateData.id);
          }
        } else {
          // Create a new entry
          const { data: queueData, error: queueError } = await supabase
            .from('call_queue')
            .insert({
              phone_list_id: testPhoneId,
              survey_id: testSurveyId,
              voice_option: 'ELEVENLABS_' + Object.keys(VOICE_OPTIONS).find(key => VOICE_OPTIONS[key] === voiceId) || 'RACHEL',
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
            console.log('Created new call queue entry:', queueData.id);
          }
        }
        
      } catch (error) {
        console.error('Error initiating Twilio call:', error);
        console.error('Error details:', error.message);
        
        // Add more detailed error diagnostics
        if (error.code) {
          console.error('Error code:', error.code);
          
          // Handle common Twilio error codes
          if (error.code === 21603) {
            console.error('This is likely due to an invalid TwiML. Check if your audio URLs are accessible.');
            console.error('Make sure the audio server is running on http://localhost:3000');
          } else if (error.code === 21219) {
            console.error('Unverified phone number. For Twilio trial accounts, the recipient number must be verified.');
            console.error('Verify the number in your Twilio console: https://www.twilio.com/console/phone-numbers/verified');
          } else if (error.code === 20003) {
            console.error('Authentication error. Check your Twilio credentials.');
          } else if (error.code === 13224) {
            console.error('Invalid phone number format or unreachable number.');
          }
        }
        
        // Test if audio URLs are accessible
        console.log('\nTesting audio file accessibility:');
        try {
          const audioUrl = audioInfo[0].publicUrl;
          console.log(`Testing URL: ${audioUrl}`);
          const response = await fetch(audioUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log('✅ Audio file is accessible');
          } else {
            console.log(`❌ Audio file is NOT accessible. Status: ${response.status}`);
          }
        } catch (e) {
          console.log(`❌ Error accessing audio file: ${e.message}`);
          console.log('Make sure your audio server is running: node scripts/serve-audio-files.js');
        }
      }
    } else {
      console.log('\nTo initiate a call with ElevenLabs audio, use the --call flag');
      console.log('Example: node scripts/test-elevenlabs-call.js --call');
      console.log('Options:');
      console.log('  --phone=N    Select phone number by index (e.g., --phone=2)');
      console.log('  --voice=NAME Select ElevenLabs voice (e.g., --voice=JOSH)');
      console.log('  --keep-server Keep the audio server running after the script finishes');
      console.log('Available voices:', Object.keys(VOICE_OPTIONS).join(', '));
      
      // Stop the server if not requested to keep it running
      if (!process.argv.includes('--keep-server')) {
        stopAudioServer();
      } else {
        console.log('\nAudio server is still running. Press Ctrl+C to stop.');
      }
    }
    
  } catch (e) {
    console.error('Unexpected error:', e);
  }
}

main()
  .catch(err => {
    console.error('Top-level error:', err);
  })
  .finally(() => {
    console.log('Test completed');
  }); 