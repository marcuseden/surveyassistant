import { NextResponse } from 'next/server';
import { initiateCall } from '@/lib/twilio/utils';
import { supabase } from '@/lib/supabase/client';

/**
 * API to retry a call from the call queue
 */
export async function POST(request: Request) {
  try {
    // Get request body
    const bodyData = await request.json();
    const { callQueueId } = bodyData;
    
    if (!callQueueId) {
      return NextResponse.json(
        { error: 'Missing callQueueId parameter' },
        { status: 400 }
      );
    }
    
    console.log(`Retrying call for queue entry: ${callQueueId}`);
    
    // Get the call queue entry
    const { data: queueEntry, error: queueError } = await supabase
      .from('call_queue')
      .select('*, phone_list:phone_list_id(*), survey:survey_id(*)')
      .eq('id', callQueueId)
      .single();
      
    if (queueError || !queueEntry) {
      console.error('Error fetching call queue entry:', queueError);
      return NextResponse.json(
        { error: 'Failed to find call queue entry', details: queueError?.message },
        { status: 404 }
      );
    }
    
    console.log('Found call queue entry:', queueEntry.id);
    
    // Get phone details
    const phoneData = queueEntry.phone_list;
    const surveyData = queueEntry.survey;
    
    if (!phoneData || !surveyData) {
      return NextResponse.json(
        { error: 'Phone or survey data not found for this call queue entry' },
        { status: 400 }
      );
    }
    
    // Get survey questions
    const { data: surveyQuestions, error: sqError } = await supabase
      .from('survey_questions')
      .select('id, question_id, order')
      .eq('survey_id', queueEntry.survey_id)
      .order('order');
      
    if (sqError) {
      console.error('Error getting survey questions:', sqError);
      return NextResponse.json(
        { error: 'Failed to get survey questions', details: sqError.message },
        { status: 500 }
      );
    }
    
    // Get question IDs
    const questionIds = surveyQuestions?.map(link => link.question_id) || [];
    
    // Get question texts
    const { data: questionTexts, error: qtError } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('id', questionIds);
      
    if (qtError) {
      console.error('Error getting question texts:', qtError);
      return NextResponse.json(
        { error: 'Failed to get question texts', details: qtError.message },
        { status: 500 }
      );
    }
    
    // Create a map of question texts
    const textMap: {[key: string]: string} = {};
    questionTexts?.forEach(t => {
      textMap[t.id] = t.question_text;
    });
    
    // Build the combined question text
    const combinedQuestionText = surveyQuestions
      ?.map(sq => textMap[sq.question_id] || `Missing text for ${sq.question_id}`)
      .join('\n\n');
      
    if (!combinedQuestionText) {
      return NextResponse.json(
        { error: 'No questions found for this survey' },
        { status: 400 }
      );
    }
    
    // Check if this is ElevenLabs voice
    const use11Labs = queueEntry.voice_option?.startsWith('ELEVENLABS_') || false;
    const voiceOption = use11Labs 
      ? queueEntry.voice_option.replace('ELEVENLABS_', '')
      : queueEntry.voice_option || 'Google.en-US-Wavenet-F';
    
    // Make the call
    try {
      const callSid = await initiateCall(
        phoneData.phone_number,
        combinedQuestionText,
        voiceOption,
        queueEntry.language_option || 'en-US',
        surveyData.description || '',
        phoneData.name || '',
        use11Labs
      );
      
      console.log('Call retry initiated successfully with SID:', callSid);
      
      // Update the call queue entry
      const { error: updateError } = await supabase
        .from('call_queue')
        .update({
          attempt_count: (queueEntry.attempt_count || 0) + 1,
          call_sid: callSid,
          status: 'in-progress',
          call_status: 'initiated',
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', callQueueId);
        
      if (updateError) {
        console.error('Error updating call queue entry:', updateError);
      }
      
      return NextResponse.json({
        success: true,
        callSid: callSid,
        message: 'Call retry initiated successfully'
      });
    } catch (error: any) {
      console.error('Error during call initiation:', error);
      
      // Update the call queue entry with the failure
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
      
      return NextResponse.json(
        { error: 'Failed to retry call', details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error during call retry:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
} 