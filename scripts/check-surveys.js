const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSurveys() {
  try {
    console.log('Checking for surveys...');
    
    // Get surveys
    const { data: surveys, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (surveyError) throw surveyError;
    
    if (!surveys || surveys.length === 0) {
      console.log('No surveys found in database.');
      return;
    }
    
    console.log(`Found ${surveys.length} surveys:`);
    surveys.forEach((survey, index) => {
      console.log(`\n${index + 1}. ${survey.name}`);
      console.log(`   ID: ${survey.id}`);
      console.log(`   Description: ${survey.description || 'No description'}`);
      console.log(`   Created: ${new Date(survey.created_at).toLocaleString()}`);
    });
    
    // Get the first survey's questions
    if (surveys.length > 0) {
      const firstSurvey = surveys[0];
      console.log(`\nChecking questions for survey: ${firstSurvey.name}`);
      
      const { data: surveyQuestions, error: sqError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', firstSurvey.id)
        .order('"order"', { ascending: true });
      
      if (sqError) throw sqError;
      
      if (!surveyQuestions || surveyQuestions.length === 0) {
        console.log('No questions found for this survey.');
        return;
      }
      
      console.log(`Found ${surveyQuestions.length} questions in this survey:`);
      
      // Get question details
      const questionIds = surveyQuestions.map(sq => sq.question_id);
      const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds);
      
      if (qError) throw qError;
      
      if (!questions) {
        console.log('Could not retrieve question details.');
        return;
      }
      
      // Map questions with their survey order
      surveyQuestions.forEach((sq, index) => {
        const question = questions.find(q => q.id === sq.question_id);
        if (question) {
          console.log(`\n   Question ${index + 1} (order ${sq["order"]}): ${question.question_text}`);
        } else {
          console.log(`\n   Question ${index + 1} (order ${sq["order"]}): Not found (ID: ${sq.question_id})`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error checking surveys:', error);
  }
}

checkSurveys(); 