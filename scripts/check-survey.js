// This script checks the survey details in the database
// Run with: node scripts/check-survey.js

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

// The ID of the survey we want to check
const SURVEY_ID = '16e93f4d-df13-49f8-a559-a23d125992d5';

async function checkSurvey() {
  console.log(`Checking survey with ID ${SURVEY_ID}...`);
  
  // Get the survey details
  const { data: survey, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', SURVEY_ID)
    .single();
    
  if (error) {
    console.error('Error fetching survey:', error);
    return;
  }
  
  console.log('Survey details:');
  console.log(survey);
  
  // Check if description field exists
  if (survey.description === undefined) {
    console.log('\nThe description field does not exist in the surveys table.');
  } else if (survey.description === null || survey.description === '') {
    console.log('\nThe survey has no description. You might want to add one.');
  } else {
    console.log('\nThe survey has a description: ' + survey.description);
  }
  
  // Show table structure
  const { data: columns, error: columnsError } = await supabase
    .rpc('get_table_columns', { table_name: 'surveys' });
    
  if (columnsError) {
    console.error('Error fetching table structure:', columnsError);
    return;
  }
  
  console.log('\nColumns in the surveys table:');
  columns.forEach(col => {
    console.log(`- ${col.column_name} (${col.data_type})`);
  });
}

checkSurvey(); 