const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase connection with service key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

// Create a Supabase client with the service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRlsPolicy() {
  try {
    console.log('Fixing RLS policy infinite recursion issue...');

    // Read the SQL file
    const fs = require('fs');
    const path = require('path');
    const migrationFile = path.join(__dirname, '../supabase/migrations/20240610000000_fix_rls_recursion.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error('Migration file not found:', migrationFile);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Execute SQL via REST API
    console.log('Applying fix...');
    
    // Use rpc to execute SQL directly
    const { error } = await supabase.rpc('exec_sql', { 
      sql_query: sql 
    });
    
    if (error) {
      console.error('Error applying fix:', error);
      
      // Try alternative approach with individual statements
      console.log('Trying alternative approach with individual statements...');
      
      // Split SQL into statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
        
      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        });
        
        if (error) {
          console.error('Error executing statement:', error);
        }
      }
      
      process.exit(1);
    }
    
    console.log('RLS policy fix applied successfully!');
    console.log('The infinite recursion issue should now be fixed.');
    console.log('Please restart your application to see the changes take effect.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

fixRlsPolicy(); 