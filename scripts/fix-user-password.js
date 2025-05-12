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

async function resetPassword() {
  try {
    const email = 'm_lowegren@mac.com';
    
    console.log(`Sending password reset email to: ${email}`);
    
    // This will send a password reset link to the email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000',
    });
    
    if (error) {
      console.error('Error sending password reset:', error);
      return;
    }
    
    console.log('Password reset email sent successfully!');
    console.log('Please check your email and follow the link to reset your password.');
    console.log('After resetting, you can use the new password to log in.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

resetPassword(); 