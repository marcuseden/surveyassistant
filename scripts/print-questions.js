const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getTableColumns(tableName) {
  try {
    // This query will get the column information from PostgreSQL's information_schema
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      ` 
    });
    
    if (error) {
      console.error('Error checking table structure:', error);
      return [];
    }
    
    if (data && data.length > 0) {
      return data.map(col => col.column_name);
    }
    
    return [];
  } catch (error) {
    console.error('Error checking columns:', error);
    return [];
  }
}

async function getAllQuestions() {
  try {
    console.log('Fetching all questions from the database...\n');
    
    // Get all questions
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    if (!questions || questions.length === 0) {
      console.log('No questions found in database.');
      return;
    }
    
    console.log(`Found ${questions.length} questions in the database:`);
    
    // Print questions in a more readable format
    questions.forEach((question, index) => {
      console.log(`\n-----------------------------------------`);
      console.log(`Question ${index + 1}: ${question.question_text}`);
      console.log(`-----------------------------------------`);
      console.log(`ID: ${question.id}`);
      console.log(`Is Follow-up: ${question.is_follow_up}`);
      
      if (question.parent_question_id) {
        const parentQuestion = questions.find(q => q.id === question.parent_question_id);
        console.log(`Parent Question: ${parentQuestion ? parentQuestion.question_text : question.parent_question_id}`);
      }
      
      console.log(`Created: ${new Date(question.created_at).toLocaleString()}`);
    });
    
    // Print a summary of just the question text
    console.log('\n\n=== SUMMARY OF ALL QUESTION TEXT ===');
    questions.forEach((question, index) => {
      console.log(`\n${index + 1}. ${question.question_text}`);
    });
    
  } catch (error) {
    console.error('Error fetching questions:', error);
  }
}

getAllQuestions(); 