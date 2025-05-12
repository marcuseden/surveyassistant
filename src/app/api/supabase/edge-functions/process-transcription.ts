// This file is commented out as it uses Deno imports which are not compatible with Next.js
// It would need to be deployed as a Supabase Edge Function instead

/*
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.8.0';
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';

// Initialize OpenAI
const configuration = new Configuration({ apiKey: openaiApiKey });
const openai = new OpenAIApi(configuration);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to extract numeric values
async function extractNumericValue(question: string, answer: string): Promise<number | null> {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You analyze survey responses to extract numeric values. If the response contains a rating or a numeric answer (like '8 out of 10' or 'I rate it a 7'), extract just the number. For questions with specific options like 'No impact' to 'Severe impact', map them to a scale where No impact=1, Minor impact=2, Moderate impact=3, Severe impact=4. For yes/no questions, map Yes=1, No=0. For ranges like '18 to 24', return the average (21). If no numeric value is present or applicable, return null."
        },
        {
          role: "user", 
          content: `Question: "${question}"\nAnswer: "${answer}"\nExtract numeric value:`
        }
      ],
      temperature: 0
    });

    const result = completion.data.choices[0].message?.content?.trim();
    
    if (!result || result.toLowerCase() === 'null') {
      return null;
    }
    
    return parseFloat(result);
  } catch (error) {
    console.error('Error extracting numeric value:', error);
    return null;
  }
}

// Helper function to extract key insights
async function extractKeyInsights(question: string, answer: string): Promise<string> {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You analyze survey responses to extract key insights. Summarize the most important points in the response, focusing on specific details, pain points, or suggestions. Keep it concise and factual, highlighting what would be most useful for quantitative analysis. Limit to 1-2 sentences maximum."
        },
        {
          role: "user", 
          content: `Question: "${question}"\nAnswer: "${answer}"\nExtract key insights:`
        }
      ],
      temperature: 0.3
    });

    return completion.data.choices[0].message?.content?.trim() || '';
  } catch (error) {
    console.error('Error extracting key insights:', error);
    return '';
  }
}

// Main handler for processing transcriptions
serve(async (req) => {
  try {
    // Parse the request body
    const { phoneCallId, transcription } = await req.json();
    
    if (!phoneCallId || !transcription) {
      return new Response(
        JSON.stringify({ error: 'Phone call ID and transcription are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the call record to find which survey and questions were used
    const { data: callData, error: callError } = await supabase
      .from('phone_calls')
      .select('*, survey_id')
      .eq('id', phoneCallId)
      .single();
      
    if (callError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call data' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the survey questions
    const { data: surveyQuestions, error: surveyError } = await supabase
      .from('survey_questions')
      .select('*, question:question_id(id, question_text)')
      .eq('survey_id', callData.survey_id)
      .order('order');
      
    if (surveyError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch survey questions' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Simple approach to extract answer for each question
    const responses = [];
    for (const sq of surveyQuestions) {
      const question = sq.question.question_text;
      
      // Find the answer by looking for text that follows the question in the transcription
      const questionIndex = transcription.indexOf(question);
      if (questionIndex !== -1) {
        // Look for the start of the next question or the end of the transcription
        let nextQuestionIndex = transcription.length;
        for (const nextSq of surveyQuestions) {
          if (nextSq.order > sq.order) {
            const nextIndex = transcription.indexOf(nextSq.question.question_text, questionIndex + question.length);
            if (nextIndex !== -1 && nextIndex < nextQuestionIndex) {
              nextQuestionIndex = nextIndex;
            }
          }
        }
        
        // Extract the answer
        const answer = transcription.substring(questionIndex + question.length, nextQuestionIndex).trim();
        
        if (answer) {
          // Process the answer with AI
          const [numericValue, keyInsights] = await Promise.all([
            extractNumericValue(question, answer),
            extractKeyInsights(question, answer)
          ]);
          
          // Save the response
          const { data: responseData, error: responseError } = await supabase
            .from('responses')
            .insert({
              phone_call_id: phoneCallId,
              question_id: sq.question_id,
              answer_text: answer,
              numeric_value: numericValue,
              key_insights: keyInsights
            })
            .select();
            
          if (responseError) {
            console.error('Error saving response:', responseError);
          } else {
            responses.push(responseData[0]);
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        responses_processed: responses.length,
        responses 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing transcription:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
*/ 