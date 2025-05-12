// Script to check database table schema
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
  // Allow specifying a table name via command line
  const tableArg = process.argv[2] || 'call_queue';
  console.log(`Checking schema for table: ${tableArg}`);
  
  try {
    // Fetch a row from the table to infer schema
    const { data, error } = await supabase
      .from(tableArg)
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error fetching data:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No data found in table. Trying to fetch structure...');
      
      // Try to insert a dummy row to get schema errors
      const { error: insertError } = await supabase
        .from(tableArg)
        .insert({
          dummy_field: 'dummy_value'
        });
        
      if (insertError) {
        console.log('Error from insert (expected):', insertError);
      }
      
      return;
    }
    
    // Get the structure from the first row
    const row = data[0];
    console.log('\nTable structure:');
    const columns = Object.keys(row);
    
    columns.forEach(column => {
      const value = row[column];
      const type = typeof value;
      const isNull = value === null;
      console.log(`- ${column}: ${isNull ? 'NULL' : type}`);
    });
    
    // Special checks for PostgreSQL JSONB columns
    for (const column of columns) {
      const value = row[column];
      if (value !== null && typeof value === 'object') {
        console.log(`\nDetailed structure of JSONB column: ${column}`);
        console.log(JSON.stringify(value, null, 2));
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
    console.log('\nSchema check completed');
  }); 