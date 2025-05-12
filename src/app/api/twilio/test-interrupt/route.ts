import { NextResponse } from 'next/server';
import elevenlabs from '@/lib/elevenlabs/client';

/**
 * This endpoint generates sample TwiML with interruption enabled
 * to test the bargeIn functionality of Twilio.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const use11labs = url.searchParams.get('use11labs') === 'true';
  const voiceOption = url.searchParams.get('voice') || 'Google.en-US-Wavenet-F';
  
  let twiml = '';
  
  if (use11labs) {
    // Generate TwiML with ElevenLabs audio and bargeIn enabled
    const textSegments = [
      "Hello. This is a test of the ElevenLabs integration with interruption support.",
      "Try speaking or pressing a key while this message is playing to test interrupting me.",
      "You should be able to interrupt this long message by speaking at any point during playback. This makes the experience more natural and conversational for users who want to respond quickly without waiting for the entire message to finish."
    ];
    
    try {
      // Generate audio for the test segments
      const audioUrls = await elevenlabs.prepareCallScript(textSegments);
      
      // Create TwiML with bargeIn enabled
      twiml = '<?xml version="1.0" encoding="UTF-8"?>';
      twiml += '<Response>';
      
      // Play the first segment with no interruption
      if (audioUrls.length > 0) {
        twiml += `<Play>${audioUrls[0]}</Play>`;
      }
      
      // Add a Gather with bargeIn to test interruption
      twiml += '<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?interrupt=true" method="POST">';
      
      // Play the second segment which can be interrupted
      if (audioUrls.length > 1) {
        twiml += `<Play>${audioUrls[1]}</Play>`;
      }
      
      if (audioUrls.length > 2) {
        twiml += `<Play>${audioUrls[2]}</Play>`;
      }
      
      twiml += '</Gather>';
      twiml += '</Response>';
    } catch (error) {
      console.error('Error generating ElevenLabs audio:', error);
      
      // Fallback to TTS if ElevenLabs fails
      twiml = '<?xml version="1.0" encoding="UTF-8"?>';
      twiml += '<Response>';
      twiml += `<Say>Unable to generate ElevenLabs audio. Falling back to standard TTS.</Say>`;
      twiml += `<Say>This is a test of the interruption feature with standard TTS.</Say>`;
      twiml += '</Response>';
    }
  } else {
    // Generate TwiML with standard Twilio TTS and bargeIn enabled
    twiml = '<?xml version="1.0" encoding="UTF-8"?>';
    twiml += '<Response>';
    twiml += `<Say voice="${voiceOption}">Hello. This is a test of the interruption feature with standard TTS.</Say>`;
    twiml += '<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?interrupt=true" method="POST">';
    twiml += `<Say voice="${voiceOption}">Try speaking or pressing a key while this message is playing to test interrupting me.</Say>`;
    twiml += `<Say voice="${voiceOption}">You should be able to interrupt this long message by speaking at any point during playback. This makes the experience more natural and conversational for users who want to respond quickly without waiting for the entire message to finish.</Say>`;
    twiml += '</Gather>';
    twiml += '</Response>';
  }
  
  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml'
    }
  });
}