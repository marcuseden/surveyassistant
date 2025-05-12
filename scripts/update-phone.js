// This script updates a phone number in the database to use a Twilio test number
// Twilio test numbers start with +15005550006 which is a magic number that simulates successful calls
// Run with: node scripts/update-phone.js

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Make sure your .env.local file contains:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Twilio test number for successful calls
const TWILIO_TEST_NUMBER = '+15005550006';

// The ID of the phone number to update (from the previous API call)
const PHONE_LIST_ID = 'd5198541-524a-4efa-a96f-8172b7f6cb6c';

async function updatePhoneNumber() {
  console.log(`Preparing to update phone with ID ${PHONE_LIST_ID} to use Twilio test number ${TWILIO_TEST_NUMBER}...`);
  
  // First, get the current phone details to verify
  const { data: currentPhone, error: fetchError } = await supabase
    .from('phone_list')
    .select('*')
    .eq('id', PHONE_LIST_ID)
    .single();
    
  if (fetchError) {
    console.error('Error fetching phone record:', fetchError);
    return;
  }
  
  console.log('Current phone record:', currentPhone);
  
  // Check if there's already a record with the test phone number
  const { data: existingTestNumber, error: testNumberError } = await supabase
    .from('phone_list')
    .select('*')
    .eq('phone_number', TWILIO_TEST_NUMBER);
    
  if (testNumberError) {
    console.error('Error checking for existing test number:', testNumberError);
    return;
  }
  
  if (existingTestNumber && existingTestNumber.length > 0) {
    console.log('Found existing test phone number record:', existingTestNumber[0]);
    console.log(`\nWill use ID: ${existingTestNumber[0].id} for testing instead of updating the existing record.`);
    console.log(`When making API calls, use phoneListId: "${existingTestNumber[0].id}" instead of "${PHONE_LIST_ID}"`);
    return;
  }
  
  // If we reach here, we can update the phone number
  console.log('No duplicate found. Updating phone number...');
  
  // Generate a unique test number by appending random digits
  const uniqueTestNumber = TWILIO_TEST_NUMBER + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  // Update the phone number
  const { data, error } = await supabase
    .from('phone_list')
    .update({ phone_number: uniqueTestNumber })
    .eq('id', PHONE_LIST_ID)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating phone number:', error);
    return;
  }
  
  console.log('Successfully updated phone record:');
  console.log(data);
  console.log('\nYou can now use this test number with Twilio without international permissions.');
}

updatePhoneNumber(); 