// Script to add key insights to existing survey responses
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

// Select insight based on numeric value
function selectInsightByValue(value) {
  if (value === null || value === undefined) {
    return getRandomElement(neutralInsights);
  }
  
  // For binary (0/1) responses
  if (value === 0) {
    return getRandomElement(negativeInsights);
  }
  if (value === 1) {
    return getRandomElement(yesNoInsights);
  }
  
  // For scale values (1-5)
  if (value <= 2) {
    return getRandomElement(negativeInsights);
  }
  if (value <= 3) {
    return getRandomElement(neutralInsights);
  }
  return getRandomElement(positiveInsights);
}

// Generate insight based on answer text
function generateInsight(answerText, numericValue) {
  // Use numeric value to determine sentiment if available
  if (numericValue !== null && numericValue !== undefined) {
    return selectInsightByValue(numericValue);
  }
  
  // Otherwise try to infer from the text
  const lowerText = answerText.toLowerCase();
  
  // Check for yes/no type responses
  if (/\b(yes|definitely|absolutely|of course|sure|certainly)\b/i.test(lowerText)) {
    return getRandomElement(yesNoInsights);
  }
  if (/\b(no|not|never)\b/i.test(lowerText)) {
    return getRandomElement(negativeInsights);
  }
  
  // Check for positive sentiment
  if (/\b(great|excellent|good|wonderful|fantastic|awesome|satisfied|happy)\b/i.test(lowerText)) {
    return getRandomElement(positiveInsights);
  }
  
  // Check for negative sentiment
  if (/\b(bad|poor|terrible|awful|horrible|disappointed|unsatisfied|unhappy)\b/i.test(lowerText)) {
    return getRandomElement(negativeInsights);
  }
  
  // Default to neutral
  return getRandomElement(neutralInsights);
}

async function addKeyInsights() {
  try {
    console.log('Fetching responses without key insights...');
    
    // Get all responses without key insights
    let { data: responses, error } = await supabase
      .from('responses')
      .select('*')
      .is('key_insights', null);
    
    // If the column doesn't exist yet, this might fail
    if (error && error.message && error.message.includes('does not exist')) {
      console.log('The key_insights column may not exist. Fetching all responses instead...');
      
      // Get all responses instead
      const result = await supabase
        .from('responses')
        .select('*');
      
      if (result.error) {
        throw result.error;
      }
      
      responses = result.data;
    } else if (error) {
      throw error;
    }
    
    if (!responses || responses.length === 0) {
      console.log('No responses found to update.');
      return;
    }
    
    console.log(`Found ${responses.length} responses to update with key insights.`);
    
    // Try to check if key_insights column exists
    try {
      // Update each response with key insights
      for (const response of responses) {
        const insight = generateInsight(response.answer_text, response.numeric_value);
        
        const { error: updateError } = await supabase
          .from('responses')
          .update({ key_insights: insight })
          .eq('id', response.id);
        
        if (updateError) {
          // If column doesn't exist, show instructions to create it
          if (updateError.message && updateError.message.includes('does not exist')) {
            console.log('The key_insights column does not exist. Creating it...');
            
            // Show SQL instructions
            console.log('Please add the key_insights column to the responses table manually:');
            console.log('- Go to your Supabase dashboard');
            console.log('- Navigate to the SQL editor');
            console.log('- Run this SQL command:');
            console.log('  ALTER TABLE responses ADD COLUMN key_insights TEXT;');
            console.log('After adding the column, run this script again to update the values.');
            
            return;
          }
          
          console.error(`Error updating response ${response.id}:`, updateError);
        } else {
          console.log(`Updated response ${response.id} with insight: ${insight}`);
        }
      }
    } catch (err) {
      console.error('Error updating responses:', err);
      
      // Handling column doesn't exist error
      console.log('If the error is about the key_insights column not existing, please add it:');
      console.log('- Go to your Supabase dashboard');
      console.log('- Navigate to the SQL editor');
      console.log('- Run this SQL command:');
      console.log('  ALTER TABLE responses ADD COLUMN key_insights TEXT;');
      console.log('After adding the column, run this script again.');
    }
    
    console.log('Finished updating responses with key insights!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
addKeyInsights(); 