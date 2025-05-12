import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

/**
 * This API handles continuing the survey after the initial greeting
 * It retrieves the call information and sends the survey questions
 */
export async function POST(request: Request) {
  try {
    // Get the call SID from the query string
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid') || '';
    const startQuestion = parseInt(searchParams.get('startQuestion') || '1');
    
    console.log(`Continuing survey for Call SID: ${callSid}, starting at question ${startQuestion}`);
    
    // Retrieve call information from the call queue if available
    let surveyId = '';
    let voiceOption = process.env.TWILIO_VOICE || 'Polly.Joanna';
    let languageOption = process.env.TWILIO_LANGUAGE || 'en-US';
    
    if (callSid) {
      try {
        const { data: queueData } = await supabase
          .from('call_queue')
          .select('survey_id, voice_option, language_option')
          .eq('call_sid', callSid)
          .single();
          
        if (queueData) {
          surveyId = queueData.survey_id || '';
          voiceOption = queueData.voice_option || voiceOption;
          languageOption = queueData.language_option || languageOption;
        }
      } catch (error) {
        console.error('Error retrieving call queue data:', error);
        // Continue with defaults if we can't get the data
      }
    }
    
    // Get survey questions if we have a survey ID
    let questions: string[] = [];
    
    if (surveyId) {
      const { data: questionData } = await supabase
        .from('survey_questions')
        .select('question_text')
        .eq('survey_id', surveyId)
        .order('display_order', { ascending: true });
        
      if (questionData && questionData.length > 0) {
        questions = questionData.map(q => q.question_text);
      }
    }
    
    // If we couldn't get questions, use a default
    if (questions.length === 0) {
      questions = [
        "How satisfied are you with your healthcare provider? Please rate on a scale from 1 to 5, where 1 is very dissatisfied and 5 is very satisfied.",
        "How easy was it to schedule your last appointment? Please rate on a scale from 1 to 5, where 1 is very difficult and 5 is very easy.",
        "Would you recommend your healthcare provider to friends or family? Please respond with yes or no."
      ];
    }
    
    // Calculate which questions to include based on startQuestion
    const remainingQuestions = questions.slice(startQuestion - 1);
    const totalQuestions = questions.length;
    
    // Build the TwiML with survey questions
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    // Only add intro text if we're at the first question
    if (startQuestion === 1) {
      const introText = "About this survey: This is a healthcare research survey. Your feedback will help improve healthcare services in your area. Your responses will be kept confidential. Each question will be followed by a beep. After the beep, please speak your answer clearly. Let's begin.";
      
      twiml += `<Say voice="${voiceOption}" language="${languageOption}">${introText}</Say>`;
      twiml += '<Pause length="1"/>';
    }
    
    // If there are no remaining questions, thank the user and hang up
    if (remainingQuestions.length === 0) {
      twiml += `<Say voice="${voiceOption}" language="${languageOption}">Thank you for participating in our survey. Your responses have been recorded. Goodbye.</Say>`;
      twiml += '</Response>';
      
      return new NextResponse(twiml, {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      });
    }
    
    // Get the current question (first of remaining questions)
    const currentQuestion = remainingQuestions[0];
    const currentQuestionIndex = startQuestion;
    
    // Add the current question with a Gather
    twiml += `<Say voice="${voiceOption}" language="${languageOption}">${currentQuestion}</Say>`;
    
    // Add a Gather for response with timeout and include the callSid in the action URL
    twiml += `<Gather input="dtmf speech" timeout="10" action="/api/twilio/response?question=${currentQuestionIndex}&amp;callSid=${callSid}&amp;totalQuestions=${totalQuestions}" method="POST">
      <Say voice="${voiceOption}">Please respond after the beep.</Say>
    </Gather>`;
    
    // If user doesn't respond, repeat the question
    twiml += `<Say voice="${voiceOption}">I didn't hear your response. Let me repeat the question.</Say>`;
    twiml += `<Redirect method="POST">/api/twilio/continue-survey?callSid=${callSid}&amp;startQuestion=${currentQuestionIndex}</Redirect>`;
    
    twiml += '</Response>';
    
    // Log the TwiML for debugging
    console.log('Generated TwiML response for continue-survey');
    
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error in continue-survey handler:', error);
    
    // Even on error, return a valid TwiML response with a simple question
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>There was an error with the survey. Thank you for your time. Goodbye.</Say></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    );
  }
} 