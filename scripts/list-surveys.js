// Script to list available surveys
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

async function listSurveys() {
  try {
    console.log('Fetching surveys...');
    
    const { data, error } = await supabase
      .from('surveys')
      .select('id, name, description, created_at');
      
    if (error) {
      console.error('Error fetching surveys:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No surveys found. Creating a test survey...');
      await createTestSurvey();
      return;
    }
    
    console.log('\nAvailable surveys:');
    data.forEach(survey => {
      console.log(`- ID: ${survey.id} | Name: ${survey.name} | Created: ${new Date(survey.created_at).toLocaleString()}`);
    });
    
    console.log('\nTo generate dummy responses, run:');
    console.log(`node scripts/generate-dummy-responses.js SURVEY_ID`);
    console.log('Replace SURVEY_ID with one of the IDs listed above.');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

async function createTestSurvey() {
  try {
    console.log('Creating test survey...');
    
    // 1. Create survey
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .insert({
        name: 'Healthcare Satisfaction Survey',
        description: 'Survey about patient healthcare experiences',
        created_by: 'system'
      })
      .select()
      .single();
      
    if (surveyError) {
      console.error('Error creating survey:', surveyError);
      return;
    }
    
    console.log(`Created survey with ID: ${survey.id}`);
    
    // 2. Create test questions
    const questions = [
      {
        question_text: 'How would you rate your overall satisfaction with our healthcare service on a scale from 1 to 5?',
        type: 'numeric'
      },
      {
        question_text: 'How likely are you to recommend our healthcare service to friends or family on a scale from 1 to 5?',
        type: 'numeric'
      },
      {
        question_text: 'Did the healthcare provider address all your concerns during your visit?',
        type: 'yes_no'
      }
    ];
    
    const questionIds = [];
    
    for (const q of questions) {
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .insert({
          question_text: q.question_text,
          type: q.type,
          created_by: 'system'
        })
        .select()
        .single();
        
      if (questionError) {
        console.error('Error creating question:', questionError);
        continue;
      }
      
      console.log(`Created question with ID: ${question.id}`);
      questionIds.push(question.id);
    }
    
    // 3. Link questions to survey
    for (let i = 0; i < questionIds.length; i++) {
      const { error: linkError } = await supabase
        .from('survey_questions')
        .insert({
          survey_id: survey.id,
          question_id: questionIds[i],
          order: i + 1
        });
        
      if (linkError) {
        console.error(`Error linking question ${questionIds[i]} to survey:`, linkError);
      }
    }
    
    console.log(`Added ${questionIds.length} questions to survey ${survey.id}`);
    console.log('\nTo generate dummy responses for this survey, run:');
    console.log(`node scripts/generate-dummy-responses.js ${survey.id}`);
  } catch (error) {
    console.error('Unexpected error creating test survey:', error);
  }
}

// Run the main function
listSurveys(); 