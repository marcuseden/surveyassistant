const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSurvey() {
  try {
    console.log('Setting up a voice-friendly survey...');
    
    // Step 1: Find the voice-friendly questions we created earlier
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .or('question_text.ilike.%Please say%,question_text.ilike.%Please tell%')
      .order('created_at', { ascending: true });
    
    if (questionsError) throw questionsError;
    
    if (!questions || questions.length === 0) {
      console.log('No voice-friendly questions found. Please run scripts/update-questions.js first.');
      return;
    }
    
    console.log(`Found ${questions.length} voice-friendly questions.`);
    
    // Step 2: Check for existing survey
    const { data: surveys, error: surveysError } = await supabase
      .from('surveys')
      .select('*')
      .eq('name', 'Primary Care Access Survey')
      .order('created_at', { ascending: false });
    
    if (surveysError) throw surveysError;
    
    let surveyId;
    
    if (!surveys || surveys.length === 0) {
      console.log('No Primary Care Access Survey found. Creating one...');
      
      // Create the survey
      const { data: newSurvey, error: createError } = await supabase
        .from('surveys')
        .insert({
          name: 'Primary Care Access Survey',
          description: 'A comprehensive survey about primary care access, barriers, and impacts on health and quality of life'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      surveyId = newSurvey.id;
      console.log(`Created new survey with ID: ${surveyId}`);
    } else {
      surveyId = surveys[0].id;
      console.log(`Using existing survey with ID: ${surveyId}`);
    }
    
    // Step 3: Add questions to the survey
    console.log(`Adding ${questions.length} questions to the survey...`);
    
    // First, check if there are existing questions in this survey
    const { data: existingQuestions, error: existingError } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', surveyId);
    
    if (existingError) throw existingError;
    
    if (existingQuestions && existingQuestions.length > 0) {
      console.log(`Survey already has ${existingQuestions.length} questions. Removing them first...`);
      
      const { error: deleteError } = await supabase
        .from('survey_questions')
        .delete()
        .eq('survey_id', surveyId);
      
      if (deleteError) throw deleteError;
      
      console.log('Existing questions removed.');
    }
    
    // Now add the voice-friendly questions to the survey
    const surveyQuestions = questions.map((question, index) => ({
      survey_id: surveyId,
      question_id: question.id,
      "order": index + 1
    }));
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('survey_questions')
      .insert(surveyQuestions)
      .select();
    
    if (insertError) throw insertError;
    
    console.log(`Successfully added ${insertedQuestions.length} questions to the survey.`);
    console.log('\nSurvey is now ready to be used for voice calls!');
    console.log('\nGo to http://localhost:3000/ to initiate a voice call to the survey.');
    
  } catch (error) {
    console.error('Error setting up survey:', error);
  }
}

setupSurvey(); 