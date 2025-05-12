require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createUser() {
  try {
    // Set user credentials
    const email = 'm_lowegren@mac.com';
    const password = 'ABC123';
    const name = 'Markus Löwegren';

    console.log(`Creating user with email: ${email}`);

    // Sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (signUpError) {
      console.error('Error creating user:', signUpError);
      return;
    }

    console.log('Auth signup successful:', authData);

    if (!authData.user) {
      console.error('No user data returned');
      return;
    }

    // Create entry in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        name: name,
        role: 'admin'
      })
      .select()
      .single();

    if (userError) {
      console.error('Error adding user to users table:', userError);
      return;
    }

    console.log('User created successfully in users table:', userData);
    console.log('\nYou can now login with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createUser(); 