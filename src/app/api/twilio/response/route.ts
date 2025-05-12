import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import elevenlabs from '@/lib/elevenlabs/client';

/**
 * This API handles responses from Twilio voice calls.
 * It receives user input from the <Gather> tag and saves it to the database.
 */
export async function POST(request: Request) {
  try {
    // Parse form data from Twilio (it sends as application/x-www-form-urlencoded)
    const formData = await request.formData();
    
    // Get the parameters from the query string and form data
    const url = new URL(request.url);
    const questionNum = parseInt(url.searchParams.get('question') || '1');
    const totalQuestions = parseInt(url.searchParams.get('totalQuestions') || '1');
    const voiceOption = url.searchParams.get('voice') || 'Google.en-US-Wavenet-F';
    const callSid = url.searchParams.get('callSid') || formData.get('CallSid')?.toString();
    const use11labs = url.searchParams.get('use11labs') === 'true';
    
    // Get user's response (SpeechResult for voice, Digits for keypad)
    const speechResult = formData.get('SpeechResult')?.toString() || '';
    const digits = formData.get('Digits')?.toString() || '';
    const userResponse = speechResult || digits || 'No response detected';
    
    // Extract numeric value if present in the response
    const numericValue = extractNumericValue(userResponse);
    
    console.log('Received Twilio response:', {
      questionNum,
      totalQuestions,
      callSid,
      speechResult,
      digits,
      userResponse,
      numericValue
    });
    
    // Special handling for "yes" responses
    if (userResponse.toLowerCase().includes('yes') && 
        questionNum === 1 && 
        !formData.get('SpeechConfidence')) {
      // This is likely a response to the initial greeting/introduction
      // Skip directly to the first actual question
      console.log('Detected "yes" response to introduction, proceeding with survey questions');
      
      // Get the first question text
      let firstQuestionText = '';
      if (callSid) {
        try {
          const { data: surveyData } = await supabase
            .from('call_queue')
            .select('survey_id')
            .eq('call_sid', callSid)
            .single();
            
          if (surveyData?.survey_id) {
            const { data: surveyQuestions } = await supabase
              .from('survey_questions')
              .select('id, question_id, order')
              .eq('survey_id', surveyData.survey_id)
              .order('order');
              
            if (surveyQuestions && surveyQuestions.length > 0) {
              const firstQuestion = surveyQuestions.find(q => q.order === 1);
              
              if (firstQuestion) {
                const { data: questionData } = await supabase
                  .from('questions')
                  .select('question_text')
                  .eq('id', firstQuestion.question_id)
                  .single();
                  
                if (questionData) {
                  firstQuestionText = questionData.question_text;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching first question:', error);
        }
      }
      
      // Generate TwiML to ask first question
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceOption}">Great! Let's begin with the first question.</Say>
  <Pause length="0.5"/>
  <Gather input="dtmf speech" timeout="15" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;use11labs=${use11labs}&amp;callSid=${callSid}" method="POST">
    <Say voice="${voiceOption}">${firstQuestionText || 'How would you rate your satisfaction with our services on a scale from 1 to 5?'}</Say>
    <Say voice="${voiceOption}">Please provide your answer now.</Say>
  </Gather>
</Response>`;

      return new NextResponse(twiml, {
        headers: {
          'Content-Type': 'text/xml'
        }
      });
    }
    
    // Check for name in response and update if needed
    const extractedName = extractName(userResponse);
    if (extractedName && callSid) {
      // Try to update the phone list record if the name is missing or generic
      const { data: phoneData, error: phoneError } = await supabase
        .from('call_queue')
        .select('phone_list_id')
        .eq('call_sid', callSid)
        .single();
        
      if (!phoneError && phoneData?.phone_list_id) {
        // Check if we have a generic or missing name
        const { data: contactData, error: contactError } = await supabase
          .from('phone_list')
          .select('name')
          .eq('id', phoneData.phone_list_id)
          .single();
          
        if (!contactError && contactData) {
          const currentName = contactData.name || '';
          
          // Check if the name is missing, generic, or different from what we extracted
          const genericNames = ['user', 'unknown', 'contact', 'customer', 'patient'];
          const shouldUpdateName = 
            !currentName || 
            currentName.toLowerCase() === 'unknown' ||
            genericNames.includes(currentName.toLowerCase()) ||
            currentName === phoneData.phone_list_id.substring(0, 8);
            
          if (shouldUpdateName) {
            console.log(`Updating contact name from "${currentName}" to "${extractedName}"`);
            const { error: updateError } = await supabase
              .from('phone_list')
              .update({ name: extractedName })
              .eq('id', phoneData.phone_list_id);
              
            if (updateError) {
              console.error('Error updating contact name:', updateError);
            } else {
              console.log('Successfully updated contact name in database');
            }
          }
        }
      }
    }
    
    // Find the call queue entry for this call
    if (callSid) {
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
            console.log('Current question:', currentQuestion.id);
            
            // Save the response to the responses table
            const { error: responseError } = await supabase
              .from('responses')
              .insert({
                phone_list_id: queueEntry.phone_list_id,
                question_id: currentQuestion.question_id,
                answer_text: userResponse,
                numeric_value: numericValue,
                call_sid: callSid
              });
              
            if (responseError) {
              console.error('Error saving response:', responseError);
            } else {
              console.log('Response saved successfully');
              
              // Update questions_answered counter
              try {
                // First get the current count
                const { data: currentQueueData } = await supabase
                  .from('call_queue')
                  .select('questions_answered')
                  .eq('id', queueEntry.id)
                  .single();
                
                // Update with the new count, if the field exists
                if (currentQueueData) {
                  const currentAnswered = currentQueueData.questions_answered || 0;
                  
                  // Only increment if this is a new question answered
                  if (questionNum > currentAnswered) {
                    const { error: updateCountError } = await supabase
                      .from('call_queue')
                      .update({
                        questions_answered: questionNum
                      })
                      .eq('id', queueEntry.id);
                    
                    if (updateCountError) {
                      console.error('Error updating questions_answered count:', updateCountError);
                    } else {
                      console.log(`Updated questions_answered to ${questionNum}/${totalQuestions}`);
                    }
                  }
                }
              } catch (error) {
                console.error('Error updating questions_answered count:', error);
              }
            }
            
            // Update the call queue with the response
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
            }
          }
        }
      }
    }
    
    // Determine if there are more questions
    const isLastQuestion = questionNum >= totalQuestions;
    let twiml = '';
    
    if (isLastQuestion) {
      // If this was the last question, end the call
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceOption}">Thank you for completing our survey. Your feedback is valuable to us. Have a great day!</Say>
  <Hangup />
</Response>`;

      // Update the call queue entry to completed
      if (callSid) {
        const { error: updateError } = await supabase
          .from('call_queue')
          .update({
            status: 'completed',
            call_status: 'completed'
          })
          .eq('call_sid', callSid);
          
        if (updateError) {
          console.error('Error updating call queue to completed:', updateError);
        }
      }
    } else {
      // Move to the next question
      const nextQuestionNum = questionNum + 1;
      
      // Get the next question text
      let nextQuestionText = '';
      if (callSid) {
        const { data: surveyData, error: surveyError } = await supabase
          .from('call_queue')
          .select('survey_id')
          .eq('call_sid', callSid)
          .single();
          
        if (!surveyError && surveyData) {
          const { data: surveyQuestions, error: sqError } = await supabase
            .from('survey_questions')
            .select('id, question_id, order')
            .eq('survey_id', surveyData.survey_id)
            .order('order');
            
          if (!sqError && surveyQuestions) {
            const nextQuestion = surveyQuestions.find(q => q.order === nextQuestionNum);
            
            if (nextQuestion) {
              const { data: questionData, error: qError } = await supabase
                .from('questions')
                .select('question_text')
                .eq('id', nextQuestion.question_id)
                .single();
                
              if (!qError && questionData) {
                nextQuestionText = questionData.question_text;
              }
            }
          }
        }
      }
      
      // If using 11labs, we would generate URL for next question audio here
      // For now, use standard TTS
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceOption}">Thank you for your answer.</Say>
  <Pause length="0.5"/>
  <Say voice="${voiceOption}">Next question...</Say>
  <Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${nextQuestionNum}&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;use11labs=${use11labs}&amp;callSid=${callSid}" method="POST">
    <Say voice="${voiceOption}">${nextQuestionText}</Say>
    <Say voice="${voiceOption}">Please answer after the tone.</Say>
  </Gather>
  <Say voice="${voiceOption}">I'm sorry, I didn't catch that. Let me ask again.</Say>
  <Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${nextQuestionNum}&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;use11labs=${use11labs}&amp;callSid=${callSid}" method="POST">
    <Say voice="${voiceOption}">${nextQuestionText}</Say>
    <Say voice="${voiceOption}">Please answer after the tone.</Say>
  </Gather>
</Response>`;
    }
    
    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml'
      }
    });
  } catch (error) {
    console.error('Error handling Twilio response:', error);
    
    // Return a safe TwiML response even in case of error
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for your response. Goodbye.</Say>
  <Hangup />
</Response>`;

    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml'
      }
    });
  }
}

/**
 * Generate TwiML response using 11labs audio files
 */
async function generate11LabsResponseTwiML(
  questionNumber: number,
  totalQuestions: number,
  callSid: string,
  personName: string = ''
): Promise<string> {
  // Generate acknowledgment of the response
  const acknowledgments = [
    "Thanks for that.",
    "I appreciate your response.",
    "Great, I've got that.",
    "Thanks, I understand.",
    "Perfect, thank you."
  ];
  
  const randomAck = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  const scriptSegments: string[] = [];
  
  if (questionNumber >= totalQuestions) {
    // This was the last question - thank user and end call
    scriptSegments.push(randomAck);
    scriptSegments.push("That was my last question. Your feedback is really valuable and will help improve healthcare services. Thank you so much for your time today. Have a wonderful day!");
    
    // Generate audio for these segments
    const audioUrls = await elevenlabs.prepareCallScript(scriptSegments);
    
    // Create TwiML with the audio files
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    for (const audioUrl of audioUrls) {
      twiml += `<Play>${audioUrl}</Play>`;
    }
    
    twiml += '</Response>';
    return twiml;
  } else {
    // Get the next question
    let nextQuestion = "";
    const nextQuestionNumber = questionNumber + 1;
    
    try {
      // Try to get the survey ID and questions from the database
      let surveyId = '';
      let questions: string[] = [];
      
      const { data: callQueueData } = await supabase
        .from('call_queue')
        .select('survey_id')
        .eq('call_sid', callSid)
        .single();
        
      if (callQueueData?.survey_id) {
        surveyId = callQueueData.survey_id;
        
        // Get the questions for this survey
        const { data: questionData } = await supabase
          .from('survey_questions')
          .select('question_text')
          .eq('survey_id', surveyId)
          .order('display_order', { ascending: true });
          
        if (questionData && questionData.length > 0) {
          questions = questionData.map(q => q.question_text);
        }
      }
      
      // If we have questions and the next question exists, use it
      if (questions.length > 0 && nextQuestionNumber <= questions.length) {
        nextQuestion = questions[nextQuestionNumber - 1];
      } else {
        // Otherwise use default questions with more conversational wording
        const defaultQuestions = [
          "How satisfied are you with your healthcare provider on a scale from 1 to 5?",
          "How easy was it to schedule your last appointment on a scale from 1 to 5?",
          "Would you recommend your healthcare provider to friends or family?"
        ];
        
        if (nextQuestionNumber <= defaultQuestions.length) {
          nextQuestion = defaultQuestions[nextQuestionNumber - 1];
        }
      }
      
      // Create script segments for the response
      scriptSegments.push(randomAck); // Acknowledgment
      
      // Add transition to next question
      const transitions = [
        `Now for question ${nextQuestionNumber}...`,
        `Let me ask you next...`,
        `For my next question...`,
        `I'd also like to know...`
      ];
      
      const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
      scriptSegments.push(randomTransition);
      
      // Add the next question
      scriptSegments.push(nextQuestion);
      
      // Add response prompt
      scriptSegments.push("I'm listening for your response now.");
      
      // Add fallback for no response
      scriptSegments.push("I'm sorry, I didn't catch your answer. Let me repeat that question.");
      
      // Generate audio for all segments
      const audioUrls = await elevenlabs.prepareCallScript(scriptSegments);
      
      // Create TwiML with the audio files and Gather for response
      let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
      
      // Play acknowledgment
      if (audioUrls.length > 0) {
        twiml += `<Play>${audioUrls[0]}</Play>`;
      }
      
      // Play transition
      if (audioUrls.length > 1) {
        twiml += `<Play>${audioUrls[1]}</Play>`;
      }
      
      // Play the question
      if (audioUrls.length > 2) {
        twiml += `<Play>${audioUrls[2]}</Play>`;
      }
      
      // Add Gather for response
      twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${nextQuestionNumber}&amp;totalQuestions=${totalQuestions}&amp;use11labs=true&amp;personName=${encodeURIComponent(personName || '')}&amp;callSid=${callSid}" method="POST">`;
      
      // Response prompt
      if (audioUrls.length > 3) {
        twiml += `<Play>${audioUrls[3]}</Play>`;
      } else {
        twiml += `<Say>Please respond after the beep.</Say>`;
      }
      
      twiml += '</Gather>';
      
      // If no response, repeat the question
      if (audioUrls.length > 4) {
        twiml += `<Play>${audioUrls[4]}</Play>`;
      }
      
      // Play the question again
      if (audioUrls.length > 2) {
        twiml += `<Play>${audioUrls[2]}</Play>`;
      }
      
      // Add another Gather
      twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${nextQuestionNumber}&amp;totalQuestions=${totalQuestions}&amp;use11labs=true&amp;personName=${encodeURIComponent(personName || '')}&amp;callSid=${callSid}" method="POST">`;
      
      if (audioUrls.length > 3) {
        twiml += `<Play>${audioUrls[3]}</Play>`;
      } else {
        twiml += `<Say>Please respond after the beep.</Say>`;
      }
      
      twiml += '</Gather>';
      
      // Final fallback
      twiml += `<Say>I'm having trouble hearing your response. Thank you for your time. Goodbye.</Say>`;
      
      twiml += '</Response>';
      return twiml;
    } catch (error) {
      console.error('Error generating 11labs response TwiML:', error);
      // Fallback to simple TwiML if error
      return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for your response. Goodbye.</Say></Response>';
    }
  }
}

/**
 * Generate TwiML response using Twilio's built-in TTS
 */
function generateTwilioTTS_ResponseTwiML(
  questionNumber: number,
  totalQuestions: number,
  callSid: string,
  voiceOption: string,
  userResponse: string
): string {
  // Generate acknowledgment of the response
  const acknowledgments = [
    "Thanks for that.",
    "I appreciate your response.",
    "Great, I've got that.",
    "Thanks, I understand.",
    "Perfect, thank you."
  ];
  
  const randomAck = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  
  if (questionNumber >= totalQuestions) {
    // This was the last question, so thank the user and hang up
    twiml += `<Say voice="${voiceOption}">${randomAck}</Say>`;
    twiml += '<Pause length="0.5"/>';
    twiml += `<Say voice="${voiceOption}">That was my last question. Your feedback is really valuable and will help improve healthcare services. Thank you so much for your time today. Have a wonderful day!</Say>`;
  } else {
    // Get the next question directly
    let nextQuestion = "";
    const nextQuestionNumber = questionNumber + 1;
    
    try {
      // Try to get the survey ID from the database first
      let surveyId = '';
      let questions: string[] = [];
      
      const { data: callQueueData } = await supabase
        .from('call_queue')
        .select('survey_id')
        .eq('call_sid', callSid)
        .single();
        
      if (callQueueData?.survey_id) {
        surveyId = callQueueData.survey_id;
        
        // Get the questions for this survey
        const { data: questionData } = await supabase
          .from('survey_questions')
          .select('question_text')
          .eq('survey_id', surveyId)
          .order('display_order', { ascending: true });
          
        if (questionData && questionData.length > 0) {
          questions = questionData.map(q => q.question_text);
        }
      }
      
      // If we have questions and the next question exists, use it
      if (questions.length > 0 && nextQuestionNumber <= questions.length) {
        nextQuestion = questions[nextQuestionNumber - 1];
      } else {
        // Otherwise use default questions with more conversational wording
        const defaultQuestions = [
          "How satisfied are you with your healthcare provider on a scale from 1 to 5?",
          "How easy was it to schedule your last appointment on a scale from 1 to 5?",
          "Would you recommend your healthcare provider to friends or family?"
        ];
        
        if (nextQuestionNumber <= defaultQuestions.length) {
          nextQuestion = defaultQuestions[nextQuestionNumber - 1];
        }
      }
      
      // If we have a next question, ask it with conversational transition
      if (nextQuestion) {
        twiml += `<Say voice="${voiceOption}">${randomAck}</Say>`;
        twiml += '<Pause length="0.5"/>';
        
        // Use different transitions between questions
        const transitions = [
          `Now for question ${nextQuestionNumber}...`,
          `Let me ask you next...`,
          `For my next question...`,
          `I'd also like to know...`
        ];
        
        const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
        twiml += `<Say voice="${voiceOption}">${randomTransition}</Say>`;
        twiml += '<Pause length="0.3"/>';
        
        twiml += `<Say voice="${voiceOption}">${nextQuestion}</Say>`;
        twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${nextQuestionNumber}&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;callSid=${callSid}" method="POST">`;
        twiml += `<Say voice="${voiceOption}">I'm listening for your response now.</Say>`;
        twiml += `</Gather>`;
        
        // If we don't get a response, repeat with a more human follow-up
        twiml += `<Say voice="${voiceOption}">I'm sorry, I didn't catch your answer. Let me repeat that question.</Say>`;
        twiml += '<Pause length="0.5"/>';
        twiml += `<Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${nextQuestionNumber}&amp;totalQuestions=${totalQuestions}&amp;voice=${voiceOption}&amp;callSid=${callSid}" method="POST">`;
        twiml += `<Say voice="${voiceOption}">${nextQuestion}</Say>`;
        twiml += `<Say voice="${voiceOption}">You can speak your answer or press a number on your keypad.</Say>`;
        twiml += `</Gather>`;
      } else {
        // If we couldn't find a next question, end the call with a friendly conclusion
        twiml += `<Say voice="${voiceOption}">${randomAck} That was my last question. Thank you so much for participating in our survey. Your insights will be very helpful! Have a great day!</Say>`;
      }
    } catch (error) {
      console.error('Error getting next question:', error);
      // If there's an error, thank the user and end the call
      twiml += `<Say voice="${voiceOption}">Thank you for your feedback. I appreciate your time today. Have a wonderful day!</Say>`;
    }
  }
  
  twiml += '</Response>';
  return twiml;
}

// Add a utility function to recognize and extract name from responses
function extractName(responseText: string): string | null {
  // Skip processing very short responses or 'yes'/'no' responses
  if (responseText.length < 3 || 
     /^(yes|no|yeah|nope|sure|okay|ok)$/i.test(responseText.trim())) {
    return null;
  }
  
  // Common patterns for name mentions
  const namePatterns = [
    /my name is (\w+)/i,
    /this is (\w+)/i, 
    /(\w+) speaking/i,
    /(\w+) here/i,
    /call me (\w+)/i,
    /i am (\w+)/i,
    /i'm (\w+)/i,
    /it's (\w+)/i,
    /hello.* (\w+) here/i,
    /hi,? (?:this is )?(\w+)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      // Make sure it's at least 3 characters to avoid false positives
      const name = match[1].trim();
      if (name.length >= 3 && 
         !/^(yes|no|yeah|nope|sure|okay|ok)$/i.test(name)) {
        console.log(`Extracted name from response: ${name}`);
        return name;
      }
    }
  }
  
  return null;
}

/**
 * Extract numeric value from spoken response
 * Examples:
 * - "5" -> 5
 * - "five" -> 5
 * - "I would say 4" -> 4
 * - "Maybe a 3 out of 5" -> 3
 */
function extractNumericValue(responseText: string): number | null {
  // First try to match a simple digit
  const digitMatch = responseText.match(/\b([0-9]|10)\b/);
  if (digitMatch) {
    return parseInt(digitMatch[1]);
  }
  
  // Then try to match words for numbers
  const wordMap: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };
  
  const lowerText = responseText.toLowerCase();
  for (const [word, value] of Object.entries(wordMap)) {
    if (lowerText.includes(word)) {
      return value;
    }
  }
  
  return null;
} 