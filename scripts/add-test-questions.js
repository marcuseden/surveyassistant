// Script to add test questions to an existing survey
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Test questions to add
const TEST_QUESTIONS = [
  "How satisfied are you with your healthcare provider on a scale from 1 to 5, with 5 being very satisfied?",
  "How easy was it to schedule an appointment with your doctor? Please rate from 1 to 5, with 5 being very easy.",
  "Did you feel that your healthcare provider listened to your concerns? Please answer yes or no."
];

async function main() {
  console.log('Adding test questions to survey...');
  
  try {
    // First, find the survey you want to add questions to
    const { data: surveys } = await supabase
      .from('surveys')
      .select('*');
      
    console.log('Available surveys:');
    surveys?.forEach(survey => {
      console.log(`- ${survey.id}: ${survey.name}`);
    });
    
    // Get survey ID from command line or use the first one
    const surveyIdArg = process.argv.find(arg => arg.startsWith('--survey='));
    let testSurveyId;
    
    if (surveyIdArg) {
      testSurveyId = surveyIdArg.split('=')[1];
    } else {
      testSurveyId = surveys?.[0]?.id;
    }
    
    if (!testSurveyId) {
      console.error('No survey ID available');
      return;
    }
    
    console.log(`\nUsing survey ID: ${testSurveyId}`);
    
    // Get existing questions for this survey
    const { data: existingQuestions, error: sqError } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', testSurveyId);
      
    if (sqError) {
      console.error('Error getting existing survey questions:', sqError);
      return;
    }
    
    console.log(`Found ${existingQuestions?.length || 0} existing survey questions for this survey`);
    
    if (existingQuestions && existingQuestions.length > 0) {
      const shouldOverwrite = process.argv.includes('--overwrite');
      
      if (!shouldOverwrite) {
        console.log('\nSurvey already has questions. Use --overwrite flag to replace them.');
        return;
      }
      
      console.log('Overwrite flag detected. Deleting existing questions...');
      
      // Delete existing survey_questions
      const { error: deleteError } = await supabase
        .from('survey_questions')
        .delete()
        .eq('survey_id', testSurveyId);
        
      if (deleteError) {
        console.error('Error deleting existing survey questions:', deleteError);
        return;
      }
      
      console.log('Existing survey questions deleted.');
    }
    
    // Add new questions
    console.log('\nAdding new questions to questions table...');
    
    const newQuestionIds = [];
    
    // Add each question to the questions table
    for (const questionText of TEST_QUESTIONS) {
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .insert({
          question_text: questionText,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (questionError) {
        console.error('Error adding question:', questionError);
        continue;
      }
      
      console.log(`Added question: "${questionText.substring(0, 30)}..." with ID ${questionData.id}`);
      newQuestionIds.push(questionData.id);
    }
    
    // Now link the questions to the survey
    console.log('\nLinking questions to survey...');
    
    const surveyQuestionLinks = newQuestionIds.map((questionId, index) => ({
      survey_id: testSurveyId,
      question_id: questionId,
      order: index + 1,
      created_at: new Date().toISOString()
    }));
    
    const { data: linkData, error: linkError } = await supabase
      .from('survey_questions')
      .insert(surveyQuestionLinks)
      .select();
      
    if (linkError) {
      console.error('Error linking questions to survey:', linkError);
      return;
    }
    
    console.log(`Successfully linked ${linkData.length} questions to survey`);
    console.log('\nTest questions added successfully!');
    console.log('Now you can run test-survey-call.js to test the call functionality');
    
  } catch (e) {
    console.error('Unexpected error:', e);
  }
}

main()
  .catch(err => {
    console.error('Top-level error:', err);
  })
  .finally(() => {
    console.log('Script completed');
  }); 