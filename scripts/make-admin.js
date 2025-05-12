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

async function makeUserAdmin() {
  try {
    const email = 'm_lowegren@mac.com';
    
    console.log(`Making user ${email} an admin...`);
    
    // Get the user by email
    const { data: { users }, error: getUserError } = await supabase.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('Error listing users:', getUserError);
      return;
    }
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }
    
    console.log('Found user:', user.id);
    
    // Update the user table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: email,
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .select();
      
    if (userError) {
      console.error('Error updating user to admin:', userError);
      return;
    }
    
    console.log('User updated to admin role:', userData);
    console.log(`User ${email} is now an admin and can log in with their password`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

makeUserAdmin(); 