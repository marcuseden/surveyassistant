import { supabase } from '../supabase/client';
import fetch from 'node-fetch';

// Environment variables
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default to "Rachel" voice
const AUDIO_BUCKET_NAME = 'voice-audio';

// Voice options
export const VOICE_OPTIONS = {
  RACHEL: 'EXAVITQu4vr4xnSDxMaL', // Rachel - warm, natural female voice
  ADAM: '29vD33N1CtxCmqQRPOHJ', // Adam - authoritative male voice
  ANTONI: 'ErXwobaYiN019PkySvjV', // Antoni - crisp male voice
  JOSH: 'TxGEqnHWrfWFTfGW9XjX', // Josh - deep male voice
  ELLI: 'MF3mGyEYCl7XYWbV9V6O', // Elli - approachable female voice
  DOMI: 'AZnzlk1XvdvUeBnXmlld', // Domi - female American professional
  BELLA: 'EXAVITQu4vr4xnSDxMaL', // Bella - natural female voice
  CALLUM: 'N2lVS1w4EtoT3dr4eOWO', // Callum - British male voice
};

/**
 * Ensures the voice audio bucket exists in Supabase Storage
 */
export async function ensureAudioBucketExists() {
  try {
    // Check if bucket exists
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return false;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === AUDIO_BUCKET_NAME);
    
    if (!bucketExists) {
      // Create the bucket with public access
      console.log('Creating voice audio bucket...');
      const { error: createError } = await supabase.storage.createBucket(AUDIO_BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (createError) {
        console.error('Error creating audio bucket:', createError);
        return false;
      }
      
      console.log(`Created new Supabase Storage bucket: ${AUDIO_BUCKET_NAME}`);
    } else {
      console.log(`Bucket ${AUDIO_BUCKET_NAME} already exists`);
    }
    
    return true;
  } catch (error) {
    console.error('Error in ensureAudioBucketExists:', error);
    return false;
  }
}

/**
 * Generate a unique filename for an audio file based on content and parameters
 */
function generateAudioFilename(text: string, voiceId: string): string {
  // Create a hash of the text content to use in the filename
  const contentHash = Buffer.from(text).toString('base64').replace(/[\/\+=]/g, '_').substring(0, 20);
  return `${voiceId}_${contentHash}.mp3`;
}

/**
 * Check if an audio file already exists in Supabase Storage
 */
async function audioFileExists(filename: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(AUDIO_BUCKET_NAME)
      .getPublicUrl(filename);
    
    if (error) return false;
    
    // Check if the file actually exists by making a HEAD request
    const response = await fetch(data.publicUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get public URL for an audio file in Supabase Storage
 */
export function getAudioPublicUrl(filename: string): string {
  const { data } = supabase.storage
    .from(AUDIO_BUCKET_NAME)
    .getPublicUrl(filename);
  
  return data.publicUrl;
}

/**
 * Generate audio from text using ElevenLabs API and store in Supabase
 */
export async function generateAndStoreAudio(
  text: string, 
  voiceId: string = ELEVENLABS_VOICE_ID || VOICE_OPTIONS.RACHEL,
  stability: number = 0.5,
  similarityBoost: number = 0.7,
  retryCount: number = 0
): Promise<string> {
  if (!ELEVENLABS_API_KEY) {
    console.warn('ELEVENLABS_API_KEY is not set. Using fallback TTS.');
    throw new Error('ELEVENLABS_API_KEY is required');
  }
  
  // Trim and clean text
  const cleanedText = text.trim();
  if (!cleanedText) {
    console.warn('Empty text provided to ElevenLabs API');
    throw new Error('Text content is required');
  }
  
  try {
    // Make sure the bucket exists
    const bucketReady = await ensureAudioBucketExists();
    if (!bucketReady) {
      console.error('Storage bucket creation failed');
      throw new Error('Could not create or access audio storage bucket');
    }
    
    // Generate a unique filename
    const filename = generateAudioFilename(cleanedText, voiceId);
    
    // Check if the file already exists
    const exists = await audioFileExists(filename);
    if (exists) {
      console.log(`Using existing audio file: ${filename}`);
      return getAudioPublicUrl(filename);
    }
    
    console.log(`Generating new audio with ElevenLabs for: "${cleanedText.substring(0, 50)}..."${cleanedText.length > 50 ? '...' : ''}`);
    console.log(`Using voice ID: ${voiceId}, API Key starts with: ${ELEVENLABS_API_KEY.substring(0, 5)}...`);
    
    // Make API call to ElevenLabs
    console.log('Sending request to ElevenLabs API...');
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
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
    
    // Handle API errors with detailed logging
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
      
      // Specific error handling based on status code
      if (statusCode === 401) {
        console.error('ElevenLabs API authentication failed - invalid API key');
        throw new Error('ElevenLabs authentication failed: Invalid API key');
      } else if (statusCode === 429) {
        console.error('ElevenLabs API rate limit exceeded');
        
        // Retry logic for rate limiting
        if (retryCount < 2) {
          console.log(`Retrying after rate limit (attempt ${retryCount + 1})...`);
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          return generateAndStoreAudio(text, voiceId, stability, similarityBoost, retryCount + 1);
        }
        
        throw new Error('ElevenLabs API rate limit exceeded');
      } else if (statusCode === 400) {
        console.error('ElevenLabs API bad request:', errorDetails);
        throw new Error(`ElevenLabs API bad request: ${errorDetails.slice(0, 100)}`);
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
    
    // Upload to Supabase Storage
    console.log(`Uploading audio to Supabase Storage as: ${filename}`);
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET_NAME)
      .upload(filename, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError);
      throw new Error(`Error uploading audio to Supabase: ${uploadError.message}`);
    }
    
    console.log('Audio file successfully uploaded to Supabase Storage');
    
    // Return the public URL
    const audioUrl = getAudioPublicUrl(filename);
    console.log(`Audio URL: ${audioUrl}`);
    return audioUrl;
  } catch (error) {
    console.error('Error generating audio:', error);
    // Provide a more helpful error message
    if (error instanceof Error) {
      throw new Error(`ElevenLabs audio generation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Prepare multiple audio files for a call script
 * This function takes an array of text segments and generates audio for each
 */
export async function prepareCallScript(
  textSegments: string[],
  voiceId: string = ELEVENLABS_VOICE_ID || VOICE_OPTIONS.RACHEL,
): Promise<string[]> {
  try {
    const audioUrls: string[] = [];
    
    // Process each segment in sequence
    for (const text of textSegments) {
      if (text.trim()) {
        const audioUrl = await generateAndStoreAudio(text, voiceId);
        audioUrls.push(audioUrl);
      }
    }
    
    return audioUrls;
  } catch (error) {
    console.error('Error preparing call script:', error);
    throw error;
  }
}

/**
 * Generate TwiML for a call using pre-generated audio files
 */
export function generateTwiML(
  audioUrls: string[],
  callSid: string,
  questionCount: number = 3
): string {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
  twiml += '<Response>';
  
  // Intro and first question
  if (audioUrls.length > 0) {
    twiml += `<Play>${audioUrls[0]}</Play>`;
  }
  
  // Add Gather for the first question's response
  twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${questionCount}&amp;callSid=${callSid}" method="POST">`;
  
  // Add the "please respond" prompt
  if (audioUrls.length > 1) {
    twiml += `<Play>${audioUrls[1]}</Play>`;
  } else {
    twiml += `<Say>Please respond after the beep.</Say>`;
  }
  
  twiml += '</Gather>';
  
  // If no response, repeat the prompt
  if (audioUrls.length > 0) {
    twiml += `<Play>${audioUrls[0]}</Play>`;
  }
  
  twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${questionCount}&amp;callSid=${callSid}" method="POST">`;
  
  if (audioUrls.length > 1) {
    twiml += `<Play>${audioUrls[1]}</Play>`;
  } else {
    twiml += `<Say>Please respond after the beep.</Say>`;
  }
  
  twiml += '</Gather>';
  
  // Final goodbye if no response
  if (audioUrls.length > 2) {
    twiml += `<Play>${audioUrls[2]}</Play>`;
  } else {
    twiml += `<Say>Thank you for your time. Goodbye.</Say>`;
  }
  
  twiml += '</Response>';
  
  return twiml;
}

export default {
  ensureAudioBucketExists,
  generateAndStoreAudio,
  prepareCallScript,
  generateTwiML,
  VOICE_OPTIONS,
}; 