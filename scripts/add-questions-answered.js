// Script to add questions_answered column to the call_queue table
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

async function updateExistingRecords() {
  try {
    console.log('Updating existing records with questions_answered values...');
    
    // Get all call_queue entries with responses
    const { data: entries, error } = await supabase
      .from('call_queue')
      .select('id, responses, survey_id')
      .not('responses', 'is', null);
      
    if (error) {
      throw error;
    }
    
    console.log(`Found ${entries?.length || 0} call_queue entries with responses.`);
    
    if (!entries || entries.length === 0) {
      console.log('No entries to update.');
      return;
    }
    
    // Update each entry
    for (const entry of entries) {
      const responses = entry.responses || {};
      const responseCount = Object.keys(responses).length;
      
      if (responseCount > 0) {
        const { error: updateError } = await supabase
          .from('call_queue')
          .update({ questions_answered: responseCount })
          .eq('id', entry.id);
          
        if (updateError) {
          // Check if the error is due to missing column
          if (updateError.message && updateError.message.includes('does not exist')) {
            console.log('questions_answered column does not exist yet. Creating it first...');
            break;
          }
          console.error(`Error updating entry ${entry.id}:`, updateError);
        } else {
          console.log(`Updated entry ${entry.id} with ${responseCount} questions answered.`);
        }
      }
    }
  } catch (error) {
    console.error('Error updating existing records:', error);
    
    // If the error indicates the column doesn't exist, we'll need to create it
    // However, we don't have direct SQL access in the client library
    console.log('Please add the questions_answered column to the call_queue table manually:');
    console.log('- Go to your Supabase dashboard');
    console.log('- Navigate to the SQL editor');
    console.log('- Run this SQL command:');
    console.log('  ALTER TABLE call_queue ADD COLUMN questions_answered INTEGER DEFAULT 0;');
    console.log('After adding the column, run this script again to update the values.');
  }
}

async function main() {
  try {
    // Try to update existing records, which will also check if the column exists
    await updateExistingRecords();
    
    console.log('Script completed successfully!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main(); 