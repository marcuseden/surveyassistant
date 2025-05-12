// Debug script to inspect the database structure
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

async function main() {
  console.log('Debugging survey_questions table...');
  
  try {
    // List all tables
    console.log('\n=== Listing Tables ===');
    const { data: tables, error: tablesError } = await supabase
      .from('_tables')
      .select('*');
    
    if (tablesError) {
      console.error('Error listing tables:', tablesError);
    } else {
      console.log(`Found ${tables?.length || 0} tables`);
    }
    
    // Get survey_questions data
    const { data: questions, error } = await supabase
      .from('survey_questions')
      .select('*')
      .limit(3);
      
    if (error) {
      console.error('Error fetching survey_questions:', error);
      return;
    }
    
    if (!questions || questions.length === 0) {
      console.log('No survey questions found');
      
      // Try to find available tables
      const { data: tablesRpc } = await supabase.rpc('get_tables');
      console.log('Available tables:', tablesRpc);
      return;
    }
    
    console.log(`\n=== Found ${questions.length} survey questions ===`);
    console.log('First question data:', questions[0]);
    
    // List all columns
    console.log('\n=== Columns in first question ===');
    const columns = Object.keys(questions[0]);
    columns.forEach(col => {
      console.log(`- ${col}: ${typeof questions[0][col]} = ${JSON.stringify(questions[0][col])}`);
    });
    
    // Check for specific columns related to question text
    console.log('\n=== Checking for text columns ===');
    const possibleTextColumns = ['question_text', 'text', 'content', 'title', 'body', 'question'];
    
    for (const col of possibleTextColumns) {
      if (columns.includes(col)) {
        console.log(`Found text column: ${col} = "${questions[0][col]}"`);
      } else {
        console.log(`Column not found: ${col}`);
      }
    }
    
    // Get surveys
    console.log('\n=== Checking surveys ===');
    const { data: surveys, error: surveysError } = await supabase
      .from('surveys')
      .select('*')
      .limit(5);
      
    if (surveysError) {
      console.error('Error fetching surveys:', surveysError);
    } else {
      console.log(`Found ${surveys?.length || 0} surveys`);
      if (surveys && surveys.length > 0) {
        console.log('First survey:', surveys[0]);
      }
    }
    
    // Get questions join with survey_questions
    console.log('\n=== Checking questions table ===');
    const { data: questionTable, error: questionTableError } = await supabase
      .from('questions')
      .select('*')
      .limit(5);
      
    if (questionTableError) {
      console.error('Error fetching questions table:', questionTableError);
    } else {
      console.log(`Found ${questionTable?.length || 0} questions in questions table`);
      if (questionTable && questionTable.length > 0) {
        console.log('First question in questions table:', questionTable[0]);
      }
    }
    
  } catch (e) {
    console.error('Unexpected error:', e);
  }
}

main()
  .catch(err => {
    console.error('Top-level error:', err);
  })
  .finally(() => {
    console.log('Debug script completed');
  }); 