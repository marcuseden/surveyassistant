const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getPhoneNumbers() {
  try {
    const { data, error } = await supabase
      .from('phone_list')
      .select('*');
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      console.log('No phone numbers found in database. Adding a test phone number...');
      
      // Add a test phone number using Twilio's test number format
      // This won't actually make a call but will be accepted by Twilio API
      const { data: newPhone, error: insertError } = await supabase
        .from('phone_list')
        .insert([
          { 
            phone_number: '+15005550006', // Twilio test number that will show as 'delivered' but not make a real call
            name: 'Test User'
          }
        ])
        .select();
      
      if (insertError) {
        console.error('Error adding test phone number:', insertError);
      } else {
        console.log('Added test phone number:', newPhone);
      }
    } else {
      console.log('Phone numbers in database:');
      data.forEach((phone, index) => {
        console.log(`${index + 1}. ${phone.name}: ${phone.phone_number} (ID: ${phone.id})`);
      });
    }
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
  }
}

getPhoneNumbers(); 