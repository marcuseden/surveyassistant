require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase connection with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

// Create a Supabase client with the service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    const email = 'm_lowegren@mac.com';
    const password = 'ABC123';
    const name = 'Markus Löwegren';
    
    console.log(`Creating admin user with email: ${email}`);
    
    // First create or update the user with admin powers
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    
    if (userError) {
      console.error('Error creating user:', userError);
      return;
    }
    
    console.log('User created/updated successfully:', userData.user.id);
    
    // Now insert or update in the users table with admin role
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .upsert({
        id: userData.user.id,
        email: email,
        name: name,
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .select();
      
    if (profileError) {
      console.error('Error updating user profile:', profileError);
      return;
    }
    
    console.log('User profile updated with admin role:', profileData);
    console.log('\nYou can now login with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createAdminUser(); 