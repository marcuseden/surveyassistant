require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase connection with service key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

// Create a Supabase client with the service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsersTable() {
  try {
    console.log('Checking auth.users table...');
    
    // Check if we can list users (this checks auth system)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error listing users:', authError);
      return;
    }
    
    console.log(`Found ${users.length} user(s) in auth.users table:`);
    users.forEach(user => {
      console.log(`- ${user.id} | ${user.email} | Confirmed: ${user.email_confirmed_at ? 'YES' : 'NO'}`);
    });
    
    // Now check if there's a public.users table
    console.log('\nChecking public.users table...');
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*');
    
    if (publicError) {
      console.error('Error querying public.users table:', publicError);
      console.log('You may need to create the public.users table. It does not appear to exist.');
      return;
    }
    
    if (!publicUsers || publicUsers.length === 0) {
      console.log('public.users table exists but has no records');
    } else {
      console.log(`Found ${publicUsers.length} record(s) in public.users table:`);
      publicUsers.forEach(user => {
        console.log(`- ${user.id} | ${user.email} | Role: ${user.role || 'none'}`);
      });
    }
    
    // Check if auth users match public users
    console.log('\nChecking for mismatches between auth.users and public.users...');
    
    if (!publicUsers) {
      console.log('Cannot check for mismatches without public.users table');
      return;
    }
    
    for (const authUser of users) {
      const matchingPublicUser = publicUsers.find(pu => pu.id === authUser.id);
      if (!matchingPublicUser) {
        console.log(`MISMATCH: User ${authUser.id} (${authUser.email}) exists in auth.users but not in public.users`);
      }
    }
    
    for (const publicUser of publicUsers) {
      const matchingAuthUser = users.find(au => au.id === publicUser.id);
      if (!matchingAuthUser) {
        console.log(`MISMATCH: User ${publicUser.id} (${publicUser.email}) exists in public.users but not in auth.users`);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUsersTable(); 