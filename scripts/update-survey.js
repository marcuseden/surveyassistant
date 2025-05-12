// This script updates a survey description in the database
// Run with: node scripts/update-survey.js

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Make sure your .env.local file contains:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// The ID of the survey to update
const SURVEY_ID = '16e93f4d-df13-49f8-a559-a23d125992d5';

// New description (edit this as needed)
const NEW_DESCRIPTION = 'This primary care survey helps us understand your experience with healthcare access, waiting times, and satisfaction. Your feedback will directly impact how we improve services.';

async function updateSurveyDescription() {
  console.log(`Updating survey with ID ${SURVEY_ID}...`);
  
  // First, get the current survey details to verify
  const { data: currentSurvey, error: fetchError } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', SURVEY_ID)
    .single();
    
  if (fetchError) {
    console.error('Error fetching survey:', fetchError);
    return;
  }
  
  console.log('Current survey details:');
  console.log(currentSurvey);
  
  // Update the survey description
  const { data, error } = await supabase
    .from('surveys')
    .update({ description: NEW_DESCRIPTION })
    .eq('id', SURVEY_ID)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating survey description:', error);
    return;
  }
  
  console.log('\nSuccessfully updated survey description:');
  console.log(data);
  console.log('\nThe new description will be used in call introductions.');
}

updateSurveyDescription(); 