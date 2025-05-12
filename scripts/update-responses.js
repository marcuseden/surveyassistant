// Script to update responses with numeric_value and key_insights
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

// Helper functions to generate response data
function extractNumericValue(text) {
  if (!text) return Math.floor(Math.random() * 5) + 1; // Default random 1-5
  
  const lowerText = text.toLowerCase();
  
  // Direct number mention
  const digitMatch = lowerText.match(/\b([1-5])\b/);
  if (digitMatch) return parseInt(digitMatch[1], 10);
  
  // Word numbers
  if (lowerText.includes('one')) return 1;
  if (lowerText.includes('two')) return 2;
  if (lowerText.includes('three')) return 3;
  if (lowerText.includes('four')) return 4;
  if (lowerText.includes('five')) return 5;
  
  // Yes/No responses
  if (/\b(yes|definitely|absolutely|of course|sure|certainly)\b/i.test(lowerText)) return 1;
  if (/\b(no|not|never)\b/i.test(lowerText)) return 0;
  
  // Sentiment analysis
  if (/\b(excellent|amazing|outstanding|great|perfect|fantastic)\b/i.test(lowerText)) return 5;
  if (/\b(good|positive|pleased|satisfied)\b/i.test(lowerText)) return 4;
  if (/\b(average|okay|ok|alright|decent|fair)\b/i.test(lowerText)) return 3;
  if (/\b(poor|disappointing|dissatisfied|inadequate)\b/i.test(lowerText)) return 2;
  if (/\b(terrible|awful|horrible|very bad)\b/i.test(lowerText)) return 1;
  
  // Default random 1-5
  return Math.floor(Math.random() * 5) + 1;
}

function generateInsight(numericValue, text) {
  const insights = {
    low: [
      "Patient reported difficulty with appointment scheduling",
      "Negative feedback about waiting time",
      "Patient expressed concerns about communication",
      "Dissatisfaction noted with processes",
      "Patient mentioned issues with billing clarity",
      "Negative experience with staff responsiveness",
      "Patient reported facility challenges",
      "Concerns expressed about cleanliness",
      "Patient suggested improvements to portals",
      "Dissatisfaction with coordination between departments"
    ],
    medium: [
      "Patient had an average experience",
      "Patient provided balanced feedback",
      "Mixed feedback about staff interaction",
      "Patient suggested some improvement areas",
      "Feedback indicates room for enhancement",
      "Patient had a routine experience",
      "Some minor concerns were mentioned",
      "Patient found the care adequate",
      "Average satisfaction with explanations",
      "Patient had a satisfactory experience"
    ],
    high: [
      "Patient expressed high satisfaction",
      "Very positive feedback about availability",
      "Patient found staff exceptionally helpful",
      "Patient highlighted excellent quality of care",
      "Strong positive sentiment regarding cleanliness",
      "Patient appreciated short waiting time",
      "Very satisfied with doctor's communication",
      "Patient mentioned staff listened well to concerns",
      "Positive remarks about follow-up process",
      "Patient noted excellent care coordination"
    ],
    yesno: [
      "Patient confirmed they would recommend this service",
      "Patient indicated they received timely care",
      "Patient affirmed receiving clear explanations",
      "Patient confirmed that staff addressed concerns",
      "Patient stated they understood instructions",
      "Patient received appropriate follow-up",
      "Patient confirmed all questions were answered",
      "Patient indicated the service met expectations",
      "Patient confirmed they felt respected during visit",
      "Patient noted they were satisfied with outcome"
    ]
  };
  
  // Select insight category
  let category;
  if (numericValue === 0) {
    category = 'low';
  } else if (numericValue === 1 && /\b(yes|definitely|absolutely|of course|sure|certainly)\b/i.test(text?.toLowerCase() || '')) {
    category = 'yesno';
  } else if (numericValue <= 2) {
    category = 'low';
  } else if (numericValue <= 3) {
    category = 'medium';
  } else {
    category = 'high';
  }
  
  // Get random insight from category
  const insightList = insights[category];
  return insightList[Math.floor(Math.random() * insightList.length)];
}

// Function to update responses with numeric_value and key_insights
async function updateResponses() {
  try {
    console.log('Updating responses with numeric_value and key_insights...');
    
    // First check if we can access the columns (if they exist)
    const { data: sampleData, error: sampleError } = await supabase
      .from('responses')
      .select('id, answer_text, numeric_value, key_insights')
      .limit(1);
      
    if (sampleError) {
      console.error('Error fetching responses:', sampleError);
      
      // Check if error is about column not existing
      if (sampleError.message && (
          sampleError.message.includes('column "numeric_value" does not exist') ||
          sampleError.message.includes('column "key_insights" does not exist')
      )) {
        console.log('\nIMPORTANT: One or more required columns do not exist in the responses table.');
        console.log('Please run the following SQL in the Supabase dashboard first:');
        console.log(`
-- Run this in the SQL editor in your Supabase dashboard
ALTER TABLE responses 
ADD COLUMN IF NOT EXISTS numeric_value INTEGER,
ADD COLUMN IF NOT EXISTS key_insights TEXT;
        `);
        return;
      }
      
      throw sampleError;
    }
    
    console.log('Columns exist, proceeding with updates...');
    
    // Get all responses
    const { data: responses, error } = await supabase
      .from('responses')
      .select('id, answer_text, numeric_value, key_insights');
      
    if (error) {
      console.error('Error fetching all responses:', error);
      throw error;
    }
    
    if (!responses || responses.length === 0) {
      console.log('No responses found to update.');
      return;
    }
    
    console.log(`Found ${responses.length} responses to update.`);
    
    // Update each response in batches to avoid rate limits
    const BATCH_SIZE = 5;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < responses.length; i += BATCH_SIZE) {
      const batch = responses.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(responses.length/BATCH_SIZE)}...`);
      
      const batchPromises = batch.map(async (response) => {
        try {
          // Only update if values are missing
          const updateData = {};
          
          if (response.numeric_value === null || response.numeric_value === undefined) {
            updateData.numeric_value = extractNumericValue(response.answer_text);
          }
          
          if (response.key_insights === null || response.key_insights === undefined) {
            // Use existing numeric value if available, otherwise extract it
            const numericValue = response.numeric_value !== null && response.numeric_value !== undefined
              ? response.numeric_value
              : updateData.numeric_value || extractNumericValue(response.answer_text);
              
            updateData.key_insights = generateInsight(numericValue, response.answer_text);
          }
          
          // Skip if no updates needed
          if (Object.keys(updateData).length === 0) {
            console.log(`Skipping response ${response.id} as it already has values.`);
            return { success: true, id: response.id, skipped: true };
          }
          
          // Update the response
          const { error: updateError } = await supabase
            .from('responses')
            .update(updateData)
            .eq('id', response.id);
            
          if (updateError) {
            console.error(`Error updating response ${response.id}:`, updateError);
            return { success: false, id: response.id, error: updateError };
          }
          
          console.log(`Updated response ${response.id} with:`, updateData);
          return { success: true, id: response.id, updated: true };
        } catch (err) {
          console.error(`Error processing response ${response.id}:`, err);
          return { success: false, id: response.id, error: err };
        }
      });
      
      const results = await Promise.all(batchPromises);
      
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      });
      
      // Add a small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < responses.length) {
        console.log('Pausing briefly before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Finished updating responses: ${successCount} succeeded, ${errorCount} failed.`);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Execute the script
console.log('Starting script to update responses with numeric_value and key_insights...');
updateResponses(); 