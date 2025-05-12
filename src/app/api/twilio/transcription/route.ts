import { NextResponse } from 'next/server';
import { saveTranscription } from '@/lib/twilio/utils';
import { generateFollowUpQuestion, saveFollowUpQuestion, processSurveyResponse } from '@/lib/openai/utils';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    // Get the URL parameters for phone and question IDs
    const url = new URL(request.url);
    const phoneListId = url.searchParams.get('phoneListId');
    const questionId = url.searchParams.get('questionId');

    // Check if we have required parameters
    if (!phoneListId || !questionId) {
      return NextResponse.json(
        { error: 'Phone list ID and question ID are required' },
        { status: 400 }
      );
    }

    // Parse the form data to get the recording URL and SID
    const formData = await request.formData();
    const recordingUrl = formData.get('RecordingUrl') as string;
    const callSid = formData.get('CallSid') as string;
    const recordingStatus = formData.get('RecordingStatus') as string;

    // For development, if we don't have a real transcription, use a mock one
    let transcriptionText = 'This is a mock transcription for development';

    // When Twilio actually provides transcription
    if (formData.has('TranscriptionText')) {
      transcriptionText = formData.get('TranscriptionText') as string;
    }

    // If there's no real recording, use mock data
    if (!recordingUrl || recordingStatus !== 'completed') {
      console.log('Using mock recording data for development');
    }

    // Process the survey response for analysis
    const processedResponse = await processSurveyResponse(questionId, transcriptionText);

    // Save the transcription with processed data
    const response = await saveTranscription(
      callSid || 'mock_call_sid',
      transcriptionText,
      phoneListId,
      questionId,
      processedResponse.numeric_value,
      processedResponse.key_insights
    );

    // Get the original question
    const { data: question } = await supabase
      .from('questions')
      .select('question_text')
      .eq('id', questionId)
      .single();

    if (question) {
      // Generate and save follow-up question
      const followUpQuestion = await generateFollowUpQuestion(
        question.question_text,
        transcriptionText
      );
      await saveFollowUpQuestion(questionId, followUpQuestion);
    }

    // Return TwiML to end the call or continue with more questions
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>Thank you for your response. Goodbye.</Say>
        <Hangup />
      </Response>`,
      {
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    );
  } catch (error) {
    console.error('Error handling transcription:', error);
    
    // Even if there's an error, we need to return valid TwiML
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>We encountered an error processing your response. Goodbye.</Say>
        <Hangup />
      </Response>`,
      {
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    );
  }
} 