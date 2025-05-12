require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createAdmin() {
  try {
    // Get email from user input
    const email = await new Promise(resolve => {
      rl.question('Enter the email of the user to make admin: ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (!email) {
      console.error('Email is required');
      rl.close();
      return;
    }

    // We'll prompt for a password to sign in
    const password = await new Promise(resolve => {
      rl.question('Enter the password for this user: ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (!password) {
      console.error('Password is required');
      rl.close();
      return;
    }

    // Sign in as this user to get the user ID
    console.log('Signing in to get user details...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) {
      console.error('Error signing in:', authError);
      rl.close();
      return;
    }

    if (!authData || !authData.user) {
      console.error('User not found. Please make sure you have created this user first.');
      rl.close();
      return;
    }

    const userId = authData.user.id;
    console.log('User authenticated successfully. User ID:', userId);

    // Check if user exists in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 is not found
      console.error('Error checking users table:', userError);
      rl.close();
      return;
    }

    let result;
    
    if (userData) {
      // Update existing user to admin
      const { data, error } = await supabase
        .from('users')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
        
      if (error) throw error;
      result = data;
      console.log('User updated to admin role');
    } else {
      // Create new user record with admin role
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email,
          role: 'admin'
        })
        .select()
        .single();
        
      if (error) throw error;
      result = data;
      console.log('User created with admin role');
    }

    console.log('Admin user details:', result);
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    rl.close();
  }
}

createAdmin(); 