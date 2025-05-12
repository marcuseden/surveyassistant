import { NextResponse } from 'next/server';
import { initiateCall } from '@/lib/twilio/utils';
import { supabase } from '@/lib/supabase/client';

/**
 * This API initiates a Twilio call to a phone number with survey questions.
 * It handles both regular and ElevenLabs voice options.
 */
export async function POST(request: Request) {
  try {
    // Get request body
    const bodyData = await request.json();
    
    // Extract parameters with let variables so they can be modified
    let phoneListId = bodyData.phoneListId;
    let surveyId = bodyData.surveyId;
    let questionId = bodyData.questionId;
    let askAllQuestions = bodyData.askAllQuestions;
    let voiceOption = bodyData.voiceOption || 'Polly.Joanna'; // Default to Twilio voice instead of ElevenLabs voice name
    let languageOption = bodyData.languageOption || 'en-US';
    let callQueueId = bodyData.callQueueId;
    let use11Labs = bodyData.use11Labs !== undefined ? bodyData.use11Labs : true;

    // If using 11Labs and no specific voice is set, default to a valid ElevenLabs voice
    if (use11Labs && (!bodyData.voiceOption || bodyData.voiceOption === 'Polly.Joanna')) {
      voiceOption = 'RACHEL'; // Use a predefined ElevenLabs voice name
    }

    console.log('Call API received request with:', { 
      phoneListId, 
      surveyId, 
      questionId, 
      askAllQuestions,
      voiceOption,
      languageOption,
      callQueueId,
      use11Labs
    });

    // Check if this is a call from the queue
    let queueItem = null;
    
    if (callQueueId) {
      const { data: queueData, error: queueError } = await supabase
        .from('call_queue')
        .select('*')
        .eq('id', callQueueId)
        .single();
        
      if (queueError || !queueData) {
        console.error('Call queue item not found:', queueError);
        return NextResponse.json(
          { error: 'Call queue item not found' },
          { status: 404 }
        );
      }
      
      // Update the queue item to in-progress
      const { error: updateError } = await supabase
        .from('call_queue')
        .update({ 
          status: 'in-progress',
          attempt_count: queueData.attempt_count + 1,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', callQueueId);
        
      if (updateError) {
        console.error('Error updating call queue item:', updateError);
      }
      
      queueItem = queueData;
    }
    
    // Prepare the variables that will be used for the call
    let phoneNumberToCall = '';
    let personName = '';
    let surveyToUse = surveyId;
    let voiceOptionToUse = voiceOption;
    let languageOptionToUse = languageOption;
    let phoneListIdToUse = phoneListId;
    
    // If we have a queue item, use its values if the params weren't provided
    if (queueItem) {
      if (queueItem.phone_list_id && !phoneListIdToUse) {
        phoneListIdToUse = queueItem.phone_list_id;
      }
      
      if (queueItem.survey_id && !surveyToUse) {
        surveyToUse = queueItem.survey_id;
      }
      
      if (queueItem.voice_option && !voiceOptionToUse) {
        voiceOptionToUse = queueItem.voice_option;
      }
      
      if (queueItem.language_option && !languageOptionToUse) {
        languageOptionToUse = queueItem.language_option;
      }
      
      // If the queue item has a phone number, use it directly
      if (queueItem.phone_number) {
        phoneNumberToCall = queueItem.phone_number;
        personName = queueItem.person_name || '';
        console.log(`Using phone number from queue: ${phoneNumberToCall}`);
      }
    }
    
    // If we don't have a phone number from the queue, look up the phone list
    if (!phoneNumberToCall && phoneListIdToUse) {
      try {
        // Get phone number from the database
        const { data: phoneData, error: phoneError } = await supabase
          .from('phone_list')
          .select('phone_number, name')
          .eq('id', phoneListIdToUse)
          .single();
        
        if (phoneError) throw phoneError;
        
        if (phoneData) {
          console.log('Found phone data:', phoneData);
          phoneNumberToCall = phoneData.phone_number;
          personName = phoneData.name || '';
        } else {
          throw new Error('Phone number not found');
        }
      } catch (error) {
        console.error('Error retrieving phone number:', error);
        return NextResponse.json(
          { error: 'Error retrieving phone number' },
          { status: 500 }
        );
      }
    }
    
    if (!phoneNumberToCall) {
      return NextResponse.json(
        { error: 'No phone number provided' },
        { status: 400 }
      );
    }
    
    if (!surveyToUse) {
      return NextResponse.json(
        { error: 'No survey ID provided' },
        { status: 400 }
      );
    }
    
    // Get the survey information
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('name, description')
      .eq('id', surveyToUse)
      .single();
      
    if (surveyError) {
      console.error('Error retrieving survey:', surveyError);
      return NextResponse.json(
        { error: 'Error retrieving survey' },
        { status: 500 }
      );
    }
    
    console.log(`Found survey: ${surveyData.name}`);
    
    // Get the survey questions with join to the questions table
    console.log(`Querying survey questions for survey ID: ${surveyToUse}`);
    
    try {
      // First, let's get the survey_questions entries
      console.log('Getting survey_questions entries with join to questions table');
      const { data: surveyQuestionLinks, error: surveyQuestionsError } = await supabase
        .from('survey_questions')
        .select('id, question_id, order')
        .eq('survey_id', surveyToUse);
      
      if (surveyQuestionsError) {
        console.error('Error getting survey questions links:', surveyQuestionsError);
        return NextResponse.json(
          { error: 'Error retrieving survey questions links', details: surveyQuestionsError.message },
          { status: 500 }
        );
      }
      
      console.log(`Found ${surveyQuestionLinks?.length || 0} questions linked to this survey`);
      
      if (!surveyQuestionLinks || surveyQuestionLinks.length === 0) {
        return NextResponse.json(
          { error: 'No questions found for this survey' },
          { status: 404 }
        );
      }
      
      // Get all question IDs
      const questionIds = surveyQuestionLinks.map(sq => sq.question_id);
      console.log(`Question IDs: ${questionIds.join(', ')}`);
      
      // Get the actual questions from the questions table
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('id, question_text')
        .in('id', questionIds);
      
      if (questionError) {
        console.error('Error getting question texts:', questionError);
        return NextResponse.json(
          { error: 'Error retrieving question texts', details: questionError.message },
          { status: 500 }
        );
      }
      
      console.log(`Retrieved ${questionData?.length || 0} question texts`);
      
      if (!questionData || questionData.length === 0) {
        return NextResponse.json(
          { error: 'Questions linked to survey not found in questions table' },
          { status: 404 }
        );
      }
      
      // Create a map of question IDs to question texts
      const questionMap = new Map();
      questionData.forEach(q => questionMap.set(q.id, q.question_text));
      
      // Sort the questions by the 'order' field and build the final questions array
      const sortedQuestions = [...surveyQuestionLinks]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(sq => {
          const questionText = questionMap.get(sq.question_id) || `Question ${sq.question_id} not found`;
          return {
            id: sq.id,
            question_id: sq.question_id,
            question_text: questionText,
            order: sq.order
          };
        });
      
      console.log(`Sorted and joined ${sortedQuestions.length} questions`);
      
      // If we have a specific question ID, just grab that one
      let combinedQuestionText = '';
      
      if (questionId && !askAllQuestions) {
        // Find in the sorted questions
        const specificQuestion = sortedQuestions.find(q => q.question_id === questionId);
        if (specificQuestion) {
          combinedQuestionText = specificQuestion.question_text;
          console.log(`Using specific question: ${combinedQuestionText.substring(0, 30)}...`);
        } else {
          console.error('Specified question not found');
          return NextResponse.json(
            { error: 'Specified question not found in survey' },
            { status: 404 }
          );
        }
      } else {
        // Get all questions and combine them
        const questionTexts = sortedQuestions.map(q => q.question_text);
        console.log(`Retrieved ${questionTexts.length} question texts`);
        questionTexts.forEach((text, i) => {
          console.log(`Question ${i+1}: ${text}`);
        });
        combinedQuestionText = questionTexts.join('\n\n');
      }
      
      console.log(`Combined question text length: ${combinedQuestionText.length}`);
      
      // Initiate the call
      console.log(`Initiating call to ${phoneNumberToCall} for survey ${surveyData.name}...`);
      
      // International number is allowed since permissions have been configured in Twilio
      console.log(`Using actual phone number: ${phoneNumberToCall} - international permissions enabled in Twilio`);
      
      try {
        // Create the call queue entry if it doesn't exist yet
        if (!callQueueId) {
          const { data: queueData, error: queueError } = await supabase
            .from('call_queue')
            .insert({
              phone_list_id: phoneListIdToUse,
              survey_id: surveyToUse,
              voice_option: voiceOptionToUse,
              language_option: languageOptionToUse,
              status: 'in-progress',
              attempt_count: 1,
              phone_number: phoneNumberToCall,
              person_name: personName,
            })
            .select()
            .single();
            
          if (queueError) {
            console.error('Error creating call queue entry:', queueError);
          } else {
            console.log('Created call queue entry:', queueData.id);
          }
        }
      
        // Make the actual call
        const callSid = await initiateCall(
          phoneNumberToCall, 
          combinedQuestionText,
          voiceOptionToUse,
          languageOptionToUse,
          surveyData.description || '',
          personName,
          use11Labs  // Pass the 11labs flag to initiateCall
        );
        
        console.log('Call initiated successfully with SID:', callSid);
        
        // Update the call queue with the call SID
        if (callQueueId) {
          const { error: updateError } = await supabase
            .from('call_queue')
            .update({ 
              call_sid: callSid,
              status: 'active',
              last_attempt_at: new Date().toISOString()
            })
            .eq('id', callQueueId);
            
          if (updateError) {
            console.error('Error updating call queue with SID:', updateError);
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          callSid: callSid,
          message: 'Call initiated successfully'
        });
      } catch (error: any) {
        console.error('Error during initiateCall:', error);
        
        // Update the call queue with the failure
        if (callQueueId) {
          const { error: updateError } = await supabase
            .from('call_queue')
            .update({ 
              status: 'failed',
              notes: `Error: ${error.message || 'Unknown error'}`
            })
            .eq('id', callQueueId);
            
          if (updateError) {
            console.error('Error updating call queue with failure:', updateError);
          }
        }
        
        return NextResponse.json(
          { error: 'Failed to initiate call', details: error.message },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('Error during survey questions retrieval:', error);
      return NextResponse.json(
        { error: 'Error retrieving survey questions', details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in call API:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
} 