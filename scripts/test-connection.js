require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase connection with anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);

// Create a Supabase client with the anon key
console.log('Creating client with anon key...');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create a service client if available
let serviceClient = null;
if (supabaseServiceKey) {
  console.log('Creating client with service key...');
  serviceClient = createClient(supabaseUrl, supabaseServiceKey);
}

async function testConnection() {
  try {
    console.log('\nTesting auth connection...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Error connecting to auth:', authError);
    } else {
      console.log('Auth connection successful!');
      console.log('Session:', authData.session ? 'Active' : 'None');
    }
    
    console.log('\nTesting data connection with anon key...');
    try {
      const { data, error } = await supabase
        .from('phone_list')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('Error connecting to database:', error);
      } else {
        console.log('Connection successful!');
        console.log('Data:', data);
      }
    } catch (e) {
      console.error('Exception occurred:', e);
    }
    
    if (serviceClient) {
      console.log('\nTesting data connection with service key...');
      try {
        const { data, error } = await serviceClient
          .from('phone_list')
          .select('*')
          .limit(1);
        
        if (error) {
          console.error('Error connecting to database with service key:', error);
        } else {
          console.log('Service key connection successful!');
          console.log('Data:', data);
        }
      } catch (e) {
        console.error('Exception with service key:', e);
      }
      
      console.log('\nTesting auth admin functionality...');
      try {
        const { data, error } = await serviceClient.auth.admin.listUsers();
        
        if (error) {
          console.error('Error listing users:', error);
        } else {
          console.log('Admin auth successful!');
          console.log('User count:', data.users.length);
        }
      } catch (e) {
        console.error('Exception with admin auth:', e);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testConnection(); 