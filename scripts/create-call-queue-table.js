// This script creates a call_queue table to track call attempts and responses
// Run with: node scripts/create-call-queue-table.js

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

async function createCallQueueTable() {
  console.log('Creating call_queue table...');
  
  try {
    // Check if the table exists by trying to query it
    const { error: existsError } = await supabase
      .from('call_queue')
      .select('count(*)', { count: 'exact', head: true });
    
    if (!existsError) {
      console.log('call_queue table already exists. Skipping creation.');
      
      // Fetch a sample record to show the schema
      const { data: sampleData } = await supabase
        .from('call_queue')
        .select('*')
        .limit(1);
      
      if (sampleData && sampleData.length > 0) {
        console.log('\nCurrent schema (based on sample record):');
        const columns = Object.keys(sampleData[0]);
        columns.forEach(col => {
          const value = sampleData[0][col];
          const type = value === null ? 'null' : typeof value;
          console.log(`- ${col} (${type})`);
        });
      }
      
      return;
    }
    
    // Table doesn't exist, let's create it
    console.log('Creating new call_queue table...');
    
    // Create the table using Supabase's schema API
    const { error: createError } = await supabase.schema
      .createTable('call_queue', [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
          defaultValue: { type: 'uuid_generate_v4' }
        },
        {
          name: 'phone_list_id',
          type: 'uuid',
          references: 'phone_list.id'
        },
        {
          name: 'survey_id',
          type: 'uuid',
          references: 'surveys.id'
        },
        {
          name: 'call_sid',
          type: 'text'
        },
        {
          name: 'status',
          type: 'text',
          notNull: true,
          defaultValue: { type: 'raw', value: "'pending'" }
        },
        {
          name: 'attempt_count',
          type: 'integer',
          notNull: true,
          defaultValue: { type: 'raw', value: '0' }
        },
        {
          name: 'last_attempt_at',
          type: 'timestamptz'
        },
        {
          name: 'next_attempt_at',
          type: 'timestamptz'
        },
        {
          name: 'created_at',
          type: 'timestamptz',
          notNull: true,
          defaultValue: { type: 'raw', value: 'now()' }
        },
        {
          name: 'updated_at',
          type: 'timestamptz',
          notNull: true,
          defaultValue: { type: 'raw', value: 'now()' }
        },
        {
          name: 'call_duration',
          type: 'integer'
        },
        {
          name: 'call_status',
          type: 'text'
        },
        {
          name: 'voice_option',
          type: 'text'
        },
        {
          name: 'language_option',
          type: 'text'
        },
        {
          name: 'responses',
          type: 'jsonb'
        },
        {
          name: 'error_message',
          type: 'text'
        },
        {
          name: 'notes',
          type: 'text'
        }
      ]);
    
    if (createError) {
      if (createError.message.includes('already exists')) {
        console.log('Table already exists (detected from error message).');
      } else {
        console.error('Error creating call_queue table:', createError);
        return;
      }
    } else {
      console.log('Successfully created call_queue table!');
    }
    
    // Add some indices
    await supabase.schema.createIndex('call_queue', ['status'], { name: 'idx_call_queue_status' });
    await supabase.schema.createIndex('call_queue', ['phone_list_id'], { name: 'idx_call_queue_phone_list_id' });
    await supabase.schema.createIndex('call_queue', ['next_attempt_at'], { name: 'idx_call_queue_next_attempt' });
    
    console.log('Created indexes on the call_queue table.');
    
    // Now add some example statuses
    console.log('\nHere are the possible status values for the call_queue table:');
    console.log('- pending: Call is queued but not yet attempted');
    console.log('- in-progress: Call is currently being processed');
    console.log('- completed: Call was successful and completed');
    console.log('- failed: Call failed (will be retried if attempt_count < max_attempts)');
    console.log('- abandoned: Call was abandoned after max retry attempts');
    console.log('- scheduled: Call is scheduled for a future time');
  } catch (err) {
    console.error('Error while creating call_queue table:', err);
  }
}

createCallQueueTable(); 