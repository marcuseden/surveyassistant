import twilio from 'twilio';
import { supabase } from '../supabase/client';
import elevenlabs from '../elevenlabs/client';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

// Speech settings for Twilio TTS (Text-to-Speech)
// Default to Google WaveNet voices which sound more natural than Polly
const defaultVoice = process.env.TWILIO_VOICE || 'Google.en-US-Wavenet-F'; // Google WaveNet female voice (more natural sounding)
const defaultLanguage = process.env.TWILIO_LANGUAGE || 'en-US';  // Default to US English

// Define ElevenLabs voice IDs directly here to avoid import issues
const ELEVENLABS_VOICES = {
  RACHEL: 'EXAVITQu4vr4xnSDxMaL', // Rachel - warm, natural female voice
  ADAM: '29vD33N1CtxCmqQRPOHJ',   // Adam - authoritative male voice
  ANTONI: 'ErXwobaYiN019PkySvjV', // Antoni - crisp male voice
  JOSH: 'TxGEqnHWrfWFTfGW9XjX',   // Josh - deep male voice
  ELLI: 'MF3mGyEYCl7XYWbV9V6O',   // Elli - approachable female voice
  DOMI: 'AZnzlk1XvdvUeBnXmlld',   // Domi - female American professional
  BELLA: 'EXAVITQu4vr4xnSDxMaL',  // Bella - natural female voice
  CALLUM: 'N2lVS1w4EtoT3dr4eOWO'  // Callum - British male voice
};

// Default 11labs voice - use Rachel voice
const default11LabsVoice = process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_VOICES.RACHEL;

// Check if we're using dummy credentials and create a mock client if needed
const isDummyCredentials = accountSid === 'dummy_sid' || authToken === 'dummy_token';
let client: any;

if (isDummyCredentials) {
  // Create a mock client for development
  client = {
    calls: {
      create: async (options: any) => {
        console.log('MOCK TWILIO CALL:', options);
        return { sid: 'MOCK_CALL_SID_' + Date.now() };
      },
      // Mock the fetch method accessed via calls(sid).fetch()
      __proto__: {
        // This gets called when client.calls(sid) is invoked
        call: function(sid: string) {
          return {
            fetch: async () => ({ status: 'completed' })
          };
        }
      }
    }
  };
  
  // Add the function accessor for client.calls(sid) 
  client.calls = function(sid: string) {
    return {
      fetch: async () => ({ status: 'completed' })
    };
  };
  
  console.warn('Using mock Twilio client with dummy credentials');
} else {
  // Use the real Twilio client
  client = twilio(accountSid, authToken);
}

// Define a type for Twilio errors
interface TwilioError {
  code?: number;
  moreInfo?: string;
  message?: string;
  status?: number;
}

export async function initiateCall(
  phoneNumber: string, 
  questionText: string,
  voiceOption: string = defaultVoice,
  languageOption: string = defaultLanguage,
  surveyDescription: string = '',
  personName: string = '',
  use11Labs: boolean = true
) {
  try {
    // Add detailed debug logging
    console.log('Initiating call to phone number:', phoneNumber);
    console.log('Using voice:', voiceOption);
    console.log('Using language:', languageOption);
    console.log('Question text length:', questionText.length);
    console.log('Person name (if provided):', personName);
    console.log('Using 11labs:', use11Labs);
    
    // Check if this is a test phone number (+1500555...) which is Twilio's test format
    const isTestPhoneNumber = phoneNumber.startsWith('+1500555');
    
    if (isTestPhoneNumber) {
      console.log('TEST PHONE NUMBER DETECTED. Using mock call instead of real call.');
      
      // Return a mock call SID for test numbers
      return 'TEST_CALL_SID_' + Date.now();
    }

    // Initialize twiml variable to avoid "used before assigned" error
    let twiml: string = '';
    
    if (use11Labs) {
      // Use 11labs for voice generation
      // Create the script segments
      const scriptSegments = createConversationalScript(questionText, surveyDescription, personName);
      
      // Use 11labs to generate voice audio files and get their URLs
      console.log('Generating voice audio with 11labs...');
      
      // Handle different voice option formats
      let voiceId;
      
      // First check if we have a predefined voice name (e.g. "RACHEL")
      if (typeof voiceOption === 'string' && ELEVENLABS_VOICES[voiceOption as keyof typeof ELEVENLABS_VOICES]) {
        voiceId = ELEVENLABS_VOICES[voiceOption as keyof typeof ELEVENLABS_VOICES];
        console.log(`Using predefined ElevenLabs voice: ${voiceOption} -> ${voiceId}`);
      } 
      // Then check if it's already a voice ID that matches ElevenLabs format
      else if (typeof voiceOption === 'string' && Object.values(ELEVENLABS_VOICES).includes(voiceOption)) {
        voiceId = voiceOption;
        console.log(`Using direct ElevenLabs voice ID: ${voiceId}`);
      }
      // If it looks like a valid ElevenLabs voice ID format (long alphanumeric string)
      else if (typeof voiceOption === 'string' && voiceOption.length > 20) {
        voiceId = voiceOption;
        console.log(`Using voice ID directly: ${voiceId}`);
      }
      // If it's a Twilio voice or unrecognized, fall back to default ElevenLabs voice 
      else {
        voiceId = default11LabsVoice;
        console.log(`Voice option "${voiceOption}" not recognized as ElevenLabs voice, using default: ${voiceId}`);
      }
      
      console.log(`Final ElevenLabs voice ID: ${voiceId}`);
      
      // Explicitly type the audioUrls array
      let audioUrls: string[] = [];
      try {
        // Ensure elevenlabs module is available before using it
        if (elevenlabs && typeof elevenlabs.prepareCallScript === 'function') {
          // Try to generate audio with ElevenLabs
          audioUrls = await elevenlabs.prepareCallScript(scriptSegments, voiceId);
          console.log(`Generated ${audioUrls.length} audio segments with 11labs`);
        } else {
          console.error('ElevenLabs module not properly loaded');
          throw new Error('ElevenLabs module not available');
        }
      } catch (elevenLabsError) {
        console.error('Error with ElevenLabs audio generation:', elevenLabsError);
        // Fall back to standard Twilio TTS if ElevenLabs fails
        console.log('Falling back to standard Twilio TTS...');
        use11Labs = false;
      }
      
      // Only proceed with 11Labs if we have audio URLs
      if (audioUrls.length > 0) {
        // Split the questions by paragraph to get an array for question counting
        const questions = questionText.split('\n\n').filter(q => q.trim());
        const totalQuestions = questions.length || 3;
        
        // Generate TwiML with Play tags for 11labs audio
        twiml = generateTwiMLWithAudio(audioUrls, totalQuestions, scriptSegments, personName);
      } else {
        // Fall back to standard Twilio TTS
        use11Labs = false;
      }
    } else {
      // Use standard Twilio TTS
      // Split the questions by paragraph to get an array
      const questions = questionText.split('\n\n').filter(q => q.trim());
      const totalQuestions = questions.length || 3;
      
      // Create a more conversational TwiML with better pacing and natural language
      twiml = '<?xml version="1.0" encoding="UTF-8"?>';
      twiml += '<Response>';
      
      // A more natural greeting with subtle pauses to simulate thinking
      twiml += `<Say voice="${voiceOption}">Hello${personName ? ' ' + personName : ''}.</Say>`;
      twiml += '<Pause length="0.5"/>';
      twiml += `<Say voice="${voiceOption}">This is an AI research assistant calling about a healthcare survey.</Say>`;
      twiml += '<Pause length="0.5"/>';
      
      // More conversational intro with prosody to sound more natural
      let introText = "I'd like to ask you a few quick questions about your healthcare experience. ";
      
      if (surveyDescription && surveyDescription.trim()) {
        introText += `${surveyDescription.trim()} `;
      }
      
      introText += "Your feedback will really help improve services in your area. Is that okay?";
      
      twiml += `<Say voice="${voiceOption}">${introText}</Say>`;
      twiml += '<Pause length="1.5"/>';
      
      // Add the first question with more conversational framing
      const firstQuestion = questions[0] || "How satisfied are you with your healthcare provider on a scale from 1 to 5?";
      
      twiml += `<Say voice="${voiceOption}">Great. First question...</Say>`;
      twiml += '<Pause length="0.5"/>';
      twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;callSid={{call_sid}}" method="POST">`;
      twiml += `<Say voice="${voiceOption}">${firstQuestion}</Say>`;
      twiml += `<Say voice="${voiceOption}">Just let me know your answer after the tone.</Say>`;
      twiml += '</Gather>';
      
      // If no response, repeat with a more natural follow-up
      twiml += `<Say voice="${voiceOption}">I'm sorry, I didn't catch that. Let me ask again.</Say>`;
      twiml += '<Pause length="0.5"/>';
      twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;callSid={{call_sid}}" method="POST">`;
      twiml += `<Say voice="${voiceOption}">${firstQuestion}</Say>`;
      twiml += `<Say voice="${voiceOption}">You can respond with your voice or press a key on your phone.</Say>`;
      twiml += '</Gather>';
      
      // Friendly goodbye
      twiml += `<Say voice="${voiceOption}">No problem. Thank you for your time. I'll try to reach you another time. Have a great day!</Say>`;
      twiml += '</Response>';
    }
    
    console.log('Making actual Twilio call...');
    
    const call = await client.calls.create({
      to: phoneNumber,
      from: twilioPhoneNumber,
      twiml: twiml,
    });
    
    console.log('Call created successfully with SID:', call.sid);
    return call.sid;
  } catch (error) {
    console.error('Error initiating call:', error);
    // Log additional details about the error
    const twilioError = error as TwilioError;
    if (twilioError.code) {
      console.error('Error code:', twilioError.code);
      console.error('More info URL:', twilioError.moreInfo);
    }
    throw error;
  }
}

/**
 * Create a conversational script from the survey questions
 */
function createConversationalScript(
  questionText: string,
  surveyDescription: string = '',
  personName: string = ''
): string[] {
  // Split questions into an array
  const questions = questionText.split('\n\n').filter(q => q.trim());
  const scriptSegments: string[] = [];
  
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

/**
 * Generate TwiML using pre-generated audio files from 11labs
 */
function generateTwiMLWithAudio(
  audioUrls: string[],
  totalQuestions: number,
  scriptSegments: string[],
  personName: string = ''
): string {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
  twiml += '<Response>';
  
  // Greeting and introduction
  if (audioUrls.length > 0) {
    twiml += `<Play>${audioUrls[0]}</Play>`; // Greeting
  }
  
  // Introduction - This is part of the introduction flow, use bargeIn=true here
  // so users can interrupt the explanation with "yes"
  if (audioUrls.length > 1) {
    twiml += `<Gather input="dtmf speech" timeout="5" bargeIn="true" action="/api/twilio/response?question=0&amp;totalQuestions=${totalQuestions}&amp;use11labs=true&amp;personName=${encodeURIComponent(personName || '')}&amp;callSid={{call_sid}}" method="POST">`;
    twiml += `<Play>${audioUrls[1]}</Play>`; // Introduction
    twiml += '</Gather>';
  }
  
  // Transition to first question
  if (audioUrls.length > 2) {
    twiml += `<Play>${audioUrls[2]}</Play>`; // Transition
  }
  
  // First question - this plays the actual first question
  if (audioUrls.length > 3) {
    twiml += `<Play>${audioUrls[3]}</Play>`; // Question text
  }
  
  // Add Gather for the first question
  twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;use11labs=true&amp;personName=${encodeURIComponent(personName || '')}&amp;callSid={{call_sid}}" method="POST">`;
  
  // Response prompt
  if (audioUrls.length > 4) {
    twiml += `<Play>${audioUrls[4]}</Play>`; // Response prompt
  } else {
    twiml += `<Say>Please respond after the beep.</Say>`;
  }
  
  twiml += '</Gather>';
  
  // If no response, repeat the question
  // Play the "I didn't catch that" message
  if (audioUrls.length > 5) {
    twiml += `<Play>${audioUrls[5]}</Play>`; // Didn't catch that
  }
  
  // Play the question again
  if (audioUrls.length > 3) {
    twiml += `<Play>${audioUrls[3]}</Play>`; // Question text again
  }
  
  // Add another Gather
  twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;use11labs=true&amp;personName=${encodeURIComponent(personName || '')}&amp;callSid={{call_sid}}" method="POST">`;
  
  // Response prompt
  if (audioUrls.length > 4) {
    twiml += `<Play>${audioUrls[4]}</Play>`; // Response prompt
  } else {
    twiml += `<Say>Please respond after the beep.</Say>`;
  }
  
  twiml += '</Gather>';
  
  // Goodbye if still no response
  if (audioUrls.length > 6) {
    twiml += `<Play>${audioUrls[6]}</Play>`; // Goodbye
  } else {
    twiml += `<Say>Thank you for your time. Goodbye.</Say>`;
  }
  
  twiml += '</Response>';
  
  return twiml;
}

/**
 * Available Twilio Voice Options:
 * 
 * Google WaveNet Voices (more natural sounding):
 * - Google.en-US-Wavenet-F (female, US)
 * - Google.en-US-Wavenet-D (male, US)
 * - Google.en-GB-Wavenet-B (male, British)
 * - Google.en-GB-Wavenet-C (female, British)
 * 
 * Amazon Polly Voices:
 * - Polly.Joanna (female, US)
 * - Polly.Matthew (male, US)
 * - Polly.Amy (female, British)
 * - Polly.Brian (male, British)
 * - Polly.Camila (female, Brazilian Portuguese)
 * - Polly.Lupe (female, US Spanish)
 * - Many more: https://www.twilio.com/docs/voice/twiml/say/text-speech#polly-languages
 * 
 * Google Standard Voices:
 * - Google.en-US-Standard-C (female, US)
 * - Google.en-US-Standard-B (male, US)
 * - Google.en-GB-Standard-A (female, British) 
 * - And more: https://www.twilio.com/docs/voice/twiml/say/text-speech#google-languages
 * 
 * Language options:
 * - en-US (English, US)
 * - en-GB (English, UK)
 * - es-ES (Spanish, Spain)
 * - es-MX (Spanish, Mexico)
 * - fr-FR (French)
 * - de-DE (German)
 * - And many more
 */

export async function saveTranscription(
  callSid: string,
  transcriptionText: string,
  phoneListId: string,
  questionId: string,
  numericValue: number | null = null,
  keyInsights: string = ''
) {
  try {
    const { data, error } = await supabase
      .from('responses')
      .insert({
        phone_list_id: phoneListId,
        question_id: questionId,
        answer_text: transcriptionText,
        numeric_value: numericValue,
        key_insights: keyInsights,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving transcription:', error);
    throw error;
  }
}

export async function getCallStatus(callSid: string) {
  try {
    const call = await client.calls(callSid).fetch();
    return call.status;
  } catch (error) {
    console.error('Error getting call status:', error);
    throw error;
  }
} 