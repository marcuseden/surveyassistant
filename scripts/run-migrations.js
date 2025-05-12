#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  try {
    // Read migration files
    const migrationsPath = path.join(__dirname, '..', 'src', 'lib', 'supabase');
    const migrationFiles = [
      'migrations.sql',
      'auth-migration.sql'
    ];

    console.log('Running migrations...');

    // Process each migration file
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsPath, file);
      
      try {
        if (fs.existsSync(filePath)) {
          const sql = fs.readFileSync(filePath, 'utf8');
          
          // Split SQL into separate statements and execute them
          const statements = sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
          
          console.log(`Processing ${file} with ${statements.length} statements`);
          
          for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            try {
              const { error } = await supabase.rpc('pgmigration', { query: stmt });
              
              if (error) {
                console.error(`Error executing statement ${i + 1} in ${file}:`, error);
              } else {
                console.log(`Successfully executed statement ${i + 1} in ${file}`);
              }
            } catch (stmtError) {
              console.error(`Error executing statement ${i + 1} in ${file}:`, stmtError);
            }
          }
          
          console.log(`Completed processing ${file}`);
        } else {
          console.warn(`Migration file not found: ${filePath}`);
        }
      } catch (fileError) {
        console.error(`Error processing migration file ${file}:`, fileError);
      }
    }
    
    console.log('Migrations completed.');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations(); 