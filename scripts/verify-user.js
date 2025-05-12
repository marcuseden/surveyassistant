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

async function verifyUser() {
  try {
    const email = 'm_lowegren@mac.com';
    
    console.log(`Verifying user ${email}...`);
    
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
    
    // Update user to verified directly
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    
    if (updateError) {
      console.error('Error verifying user:', updateError);
      return;
    }
    
    console.log('User email verified successfully!');
    
    // Also reset the password to ensure it works
    const newPassword = 'ABC123';
    const { error: pwError } = await supabase.auth.admin.updateUserById(
      user.id, 
      { password: newPassword }
    );
    
    if (pwError) {
      console.error('Error updating password:', pwError);
      return;
    }
    
    console.log(`Password reset to: ${newPassword}`);
    console.log('\nYou can now login with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

verifyUser(); 