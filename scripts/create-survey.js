require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase connection with service key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

// Create a Supabase client with the service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSurvey() {
  try {
    console.log('Creating test survey...');
    
    // Check if we already have a Primary Care Survey
    const { data: existingSurveys, error: checkError } = await supabase
      .from('surveys')
      .select('*')
      .eq('name', 'Primary Care Access Survey');
    
    if (checkError) {
      console.error('Error checking for existing surveys:', checkError);
      return;
    }
    
    if (existingSurveys && existingSurveys.length > 0) {
      console.log('Survey "Primary Care Access Survey" already exists:', existingSurveys[0].id);
      return;
    }
    
    // First check if we have questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*');
    
    if (questionsError) {
      console.error('Error getting questions:', questionsError);
      return;
    }
    
    if (!questions || questions.length === 0) {
      console.log('No questions found, adding sample questions first...');
      
      // Add 3 sample questions
      const sampleQuestions = [
        {
          question_text: "Do you have a primary care doctor you see regularly? Please say 'Yes,' 'No,' or 'I don't know.'",
          is_follow_up: false,
          parent_question_id: null
        },
        {
          question_text: "How do you usually contact your primary care doctor? Please say one: 'Phone,' 'Online,' 'In-person,' 'Email,' or 'Other.'",
          is_follow_up: false,
          parent_question_id: null
        },
        {
          question_text: "How long does it usually take to get an appointment? Please say one: 'Same day,' '1 to 3 days,' '1 to 2 weeks,' '1 month or more,' or 'I can't get one.'",
          is_follow_up: false,
          parent_question_id: null
        }
      ];
      
      const { data: insertedQuestions, error: insertQuestionsError } = await supabase
        .from('questions')
        .insert(sampleQuestions)
        .select();
      
      if (insertQuestionsError) {
        console.error('Error inserting sample questions:', insertQuestionsError);
        return;
      }
      
      console.log('Added sample questions:', insertedQuestions.map(q => q.id));
      
      // Use the inserted questions
      questions = insertedQuestions;
    }
    
    // Create the survey
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .insert({
        name: 'Primary Care Access Survey',
        description: 'Survey to assess access to primary care services'
      })
      .select()
      .single();
    
    if (surveyError) {
      console.error('Error creating survey:', surveyError);
      return;
    }
    
    console.log('Created survey:', survey.id);
    
    // Add first 3 questions to the survey
    const questionsToAdd = questions.slice(0, 3);
    
    const surveyQuestions = questionsToAdd.map((question, index) => ({
      survey_id: survey.id,
      question_id: question.id,
      order: index + 1
    }));
    
    const { data: surveyQuestionsData, error: surveyQuestionsError } = await supabase
      .from('survey_questions')
      .insert(surveyQuestions)
      .select();
    
    if (surveyQuestionsError) {
      console.error('Error adding questions to survey:', surveyQuestionsError);
      return;
    }
    
    console.log('Added questions to survey:', surveyQuestionsData.length);
    console.log('Survey created successfully!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createSurvey(); 