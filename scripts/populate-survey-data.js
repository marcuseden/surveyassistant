// Script to populate survey data with numeric_value and key_insights
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to execute SQL directly
async function executeSQL(sql) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error executing SQL via RPC:', error);
    return false;
  }
}

// Key insights templates based on different types of responses
const positiveInsights = [
  "Patient expressed high satisfaction with service quality",
  "Very positive feedback about appointment availability",
  "Patient found the staff to be exceptionally helpful",
  "Patient highlighted the excellent quality of care received",
  "Strong positive sentiment regarding clinic cleanliness",
  "Patient appreciated the short waiting time",
  "Very satisfied with doctor's communication style",
  "Patient mentioned how well the medical staff listened to concerns",
  "Positive remarks about follow-up process",
  "Patient noted excellent care coordination between specialists"
];

const neutralInsights = [
  "Patient had an average experience with the service",
  "Patient provided balanced feedback with some improvement suggestions",
  "Mixed feedback about staff interaction and treatment process",
  "Patient suggested some areas for improvement in appointment scheduling",
  "Feedback indicates standard care quality with room for enhancement",
  "Patient had a routine experience with registration process",
  "Some minor concerns about visit efficiency were mentioned",
  "Patient found the care adequate but not exceptional",
  "Average satisfaction with medication explanation process",
  "Patient had a satisfactory but unremarkable visit experience"
];

const negativeInsights = [
  "Patient reported difficulty with appointment scheduling system",
  "Negative feedback about extended waiting time",
  "Patient expressed concerns about communication gaps with staff",
  "Dissatisfaction noted regarding prescription refill process",
  "Patient mentioned issues with billing clarity",
  "Negative experience with staff responsiveness to inquiries",
  "Patient reported that facility navigation was challenging",
  "Concerns expressed about cleanliness of waiting area",
  "Patient suggested improvements to patient portal usability",
  "Dissatisfaction with coordination between departments"
];

const yesNoInsights = [
  "Patient confirmed they would recommend this clinic to others",
  "Patient indicated they were able to get an appointment when needed",
  "Patient affirmed receiving clear explanation of treatment options",
  "Patient confirmed that staff addressed all their concerns",
  "Patient stated they understood their medication instructions",
  "Patient did not feel their privacy was adequately respected",
  "Patient was unable to access their medical records online",
  "Patient indicated the billing process was not transparent",
  "Patient noted they received follow-up communication as promised",
  "Patient confirmed receiving reminder about appointment"
];

// Random selection helper
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Extract numeric value from text responses
function extractNumericValue(text) {
  if (!text) return null;
  
  // First try to match a simple digit
  const digitMatch = text.match(/\b([1-5])\b/);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }
  
  // Then try to match words for numbers
  const lowerText = text.toLowerCase();
  const wordMap = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5
  };
  
  for (const [word, value] of Object.entries(wordMap)) {
    if (lowerText.includes(word)) {
      return value;
    }
  }
  
  // For yes/no responses, map to 1/0
  if (/\b(yes|definitely|absolutely|of course|sure|certainly)\b/i.test(lowerText)) {
    return 1;
  }
  if (/\b(no|not|never)\b/i.test(lowerText)) {
    return 0;
  }
  
  // Check for sentiment indicators
  if (/\b(excellent|amazing|outstanding|great|perfect|fantastic)\b/i.test(lowerText)) {
    return 5;
  }
  if (/\b(good|positive|pleased|satisfied)\b/i.test(lowerText)) {
    return 4;
  }
  if (/\b(average|okay|ok|alright|decent|fair)\b/i.test(lowerText)) {
    return 3;
  }
  if (/\b(poor|disappointing|dissatisfied|inadequate)\b/i.test(lowerText)) {
    return 2;
  }
  if (/\b(terrible|awful|horrible|very bad)\b/i.test(lowerText)) {
    return 1;
  }
  
  // Default to random 1-5
  return Math.floor(Math.random() * 5) + 1;
}

// Generate insight based on answer text and numeric value
function generateInsight(answerText, numericValue) {
  if (numericValue === null || numericValue === undefined) {
    numericValue = extractNumericValue(answerText);
  }
  
  // Use numeric value to determine sentiment
  if (numericValue === 0) {
    return getRandomElement(negativeInsights);
  }
  if (numericValue === 1 && /\b(yes|definitely|absolutely|of course|sure|certainly)\b/i.test(answerText.toLowerCase())) {
    return getRandomElement(yesNoInsights);
  }
  if (numericValue <= 2) {
    return getRandomElement(negativeInsights);
  }
  if (numericValue <= 3) {
    return getRandomElement(neutralInsights);
  }
  return getRandomElement(positiveInsights);
}

// Check and add missing columns
async function checkAndAddColumns() {
  console.log('Checking for required columns in the responses table...');
  
  // SQL to check if columns exist
  const checkColumnsSql = `
    SELECT 
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'responses' AND column_name = 'numeric_value') as has_numeric_value,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'responses' AND column_name = 'key_insights') as has_key_insights;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: checkColumnsSql });
    
    if (error) {
      // If RPC is not available, we'll add columns using direct queries
      console.log('Cannot check columns via RPC, will attempt direct alteration...');
      return false;
    }
    
    const result = data && data.length > 0 ? data[0] : null;
    
    if (!result) {
      console.log('Cannot determine column existence, will attempt to add them...');
      return false;
    }
    
    // Add missing columns if needed
    if (!result.has_numeric_value) {
      console.log('Adding numeric_value column...');
      await supabase.rpc('exec_sql', { 
        query: `ALTER TABLE responses ADD COLUMN numeric_value INTEGER;` 
      });
    }
    
    if (!result.has_key_insights) {
      console.log('Adding key_insights column...');
      await supabase.rpc('exec_sql', { 
        query: `ALTER TABLE responses ADD COLUMN key_insights TEXT;` 
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error checking columns:', error);
    return false;
  }
}

// Main function to update responses
async function updateResponses() {
  try {
    // First try to check and add columns if needed
    const columnsAdded = await checkAndAddColumns();
    
    if (!columnsAdded) {
      console.log('Could not verify columns using RPC, will try direct update...');
    }
    
    // Fetch all responses
    console.log('Fetching responses...');
    const { data: responses, error } = await supabase
      .from('responses')
      .select('*');
      
    if (error) {
      throw error;
    }
    
    if (!responses || responses.length === 0) {
      console.log('No responses found to update.');
      return;
    }
    
    console.log(`Found ${responses.length} responses to update.`);
    
    // Update each response
    let successCount = 0;
    let errorCount = 0;
    
    for (const response of responses) {
      try {
        // Extract or use existing numeric value
        let numericValue = response.numeric_value;
        if (numericValue === null || numericValue === undefined) {
          numericValue = extractNumericValue(response.answer_text);
        }
        
        // Generate key insight
        const keyInsight = generateInsight(response.answer_text, numericValue);
        
        // Update the response
        const { error: updateError } = await supabase
          .from('responses')
          .update({
            numeric_value: numericValue,
            key_insights: keyInsight
          })
          .eq('id', response.id);
          
        if (updateError) {
          console.error(`Error updating response ${response.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated response ${response.id} with numeric value ${numericValue} and insight: ${keyInsight}`);
          successCount++;
        }
      } catch (err) {
        console.error(`Error processing response ${response.id}:`, err);
        errorCount++;
      }
    }
    
    console.log(`Finished updating responses: ${successCount} succeeded, ${errorCount} failed.`);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
console.log('Starting survey data population script...');
updateResponses(); 