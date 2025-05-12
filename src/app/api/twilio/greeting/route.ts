import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

/**
 * This API handles the greeting when a user answers the call.
 * It attempts to detect if they said their name and responds accordingly.
 */
export async function POST(request: Request) {
  try {
    // Get the parameters from the query string
    const { searchParams } = new URL(request.url);
    const defaultName = searchParams.get('name') || 'there';
    const callSid = searchParams.get('callSid') || '';
    
    console.log(`Processing greeting, Call SID: ${callSid}, Default name: ${defaultName}`);
    
    // Parse the form data from Twilio
    const formData = await request.formData();
    const speechResult = formData.get('SpeechResult');
    const actualCallSid = formData.get('CallSid') || callSid;
    
    console.log(`Speech detected: "${speechResult}"`);
    console.log(`Actual Call SID: ${actualCallSid}`);
    
    // Determine the greeting based on the speech we detected
    let greeting = '';
    let detectedName = defaultName;
    
    if (speechResult && typeof speechResult === 'string') {
      const speech = speechResult.toLowerCase();
      
      // Look for common patterns when answering a phone
      if (speech.includes('hello') || speech.includes('hi') || speech.includes('hey')) {
        greeting = 'Hello! ';
      }
      
      // Check if the default name is mentioned
      if (defaultName !== 'there' && 
          speech.toLowerCase().includes(defaultName.toLowerCase())) {
        // They mentioned their name, use it
        detectedName = defaultName;
      } 
      // Try to extract a name from common greeting patterns
      else if (speech.includes('this is ')) {
        const parts = speech.split('this is ');
        if (parts.length > 1 && parts[1].trim()) {
          detectedName = parts[1].trim().split(' ')[0]; // Take the first word after "this is"
        }
      } 
      else if (speech.includes(' speaking')) {
        const parts = speech.split(' speaking');
        if (parts.length > 0 && parts[0].trim()) {
          const words = parts[0].trim().split(' ');
          detectedName = words[words.length - 1]; // Take the last word before "speaking"
        }
      }
      
      // Log the detected name
      console.log(`Detected name: ${detectedName}`);
      
      // Update call queue with greeting information if available
      if (actualCallSid) {
        try {
          await supabase
            .from('call_queue')
            .update({ 
              notes: `Greeting detected: "${speechResult}", Using name: ${detectedName}`
            })
            .eq('call_sid', actualCallSid);
        } catch (error) {
          console.error('Error updating call queue with greeting:', error);
        }
      }
    }
    
    // Build a personalized TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Hello ${detectedName}. This is an automated healthcare research survey.</Say>
      <Redirect method="POST">/api/twilio/continue-survey?callSid=${actualCallSid}</Redirect>
    </Response>`;
    
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error in Twilio greeting handling:', error);
    
    // Even on error, return a valid TwiML response
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello there. This is an automated healthcare research survey.</Say><Redirect method="POST">/api/twilio/continue-survey</Redirect></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    );
  }
} 