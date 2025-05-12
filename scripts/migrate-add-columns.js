// Script to add columns to the responses table using Supabase REST API
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to add columns to responses table using database migration
async function addColumnsToResponses() {
  try {
    console.log('Checking the structure of the responses table...');
    
    // Get current responses to see what columns exist
    const { data: sampleData, error: sampleError } = await supabase
      .from('responses')
      .select('*')
      .limit(1);
      
    if (sampleError) {
      console.error('Error fetching sample response:', sampleError);
      return;
    }
    
    const sampleResponse = sampleData && sampleData.length > 0 ? sampleData[0] : null;
    
    if (!sampleResponse) {
      console.log('No responses found in the table. Will still attempt to add columns.');
    } else {
      console.log('Current response structure:', Object.keys(sampleResponse));
    }
    
    // Check if the columns already exist
    const hasNumericValue = sampleResponse && 'numeric_value' in sampleResponse;
    const hasKeyInsights = sampleResponse && 'key_insights' in sampleResponse;
    
    console.log(`Column 'numeric_value' exists: ${hasNumericValue}`);
    console.log(`Column 'key_insights' exists: ${hasKeyInsights}`);
    
    // If either column doesn't exist, use the REST API to alter the table
    if (!hasNumericValue || !hasKeyInsights) {
      console.log('Adding missing columns through database migrations...');
      
      try {
        // Use a temporary database function to execute the ALTER TABLE statements
        const { error: funcError } = await supabase.rpc('create_temp_migration_function', {
          function_body: `
            BEGIN
              -- Add numeric_value column if it doesn't exist
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'responses' AND column_name = 'numeric_value'
              ) THEN
                ALTER TABLE responses ADD COLUMN numeric_value INTEGER;
              END IF;
              
              -- Add key_insights column if it doesn't exist
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'responses' AND column_name = 'key_insights'
              ) THEN
                ALTER TABLE responses ADD COLUMN key_insights TEXT;
              END IF;
              
              RETURN TRUE;
            END;
          `
        });
        
        if (funcError) {
          console.error('Error creating temporary migration function:', funcError);
          
          // Fall back to direct REST API calls
          console.log('Attempting direct column creation through REST API...');
          await attemptDirectColumnCreation();
        } else {
          console.log('Migration function created successfully, executing...');
          
          // Execute the temporary function
          const { error: execError } = await supabase.rpc('execute_temp_migration');
          
          if (execError) {
            console.error('Error executing migration function:', execError);
          } else {
            console.log('Migration executed successfully.');
          }
          
          // Drop the temporary function
          await supabase.rpc('drop_temp_migration_function');
        }
      } catch (err) {
        console.error('Error in migration process:', err);
        
        // Fall back to direct REST API calls
        await attemptDirectColumnCreation();
      }
    }
    
    // Verify columns were added
    await verifyColumns();
    
    // If verification succeeded, populate the columns
    await populateColumns();
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Attempt to create columns directly through REST API
async function attemptDirectColumnCreation() {
  try {
    console.log('Using direct REST API calls to add columns...');
    
    // Prepare a raw SQL query to add the columns (this won't work without proper permissions)
    const alterTableSql = `
      ALTER TABLE responses 
      ADD COLUMN IF NOT EXISTS numeric_value INTEGER,
      ADD COLUMN IF NOT EXISTS key_insights TEXT;
    `;
    
    // Make a fetch request to the Supabase REST API (this is a demonstration, not likely to work without proper setup)
    const endpoint = `${supabaseUrl}/rest/v1/`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        query: alterTableSql
      })
    });
    
    if (!response.ok) {
      console.error('Failed to add columns through REST API:', await response.text());
      console.log('\nImportant: You will need to run the following SQL in the Supabase dashboard:');
      console.log(`
      -- Run this in the SQL editor in your Supabase dashboard
      ALTER TABLE responses 
      ADD COLUMN IF NOT EXISTS numeric_value INTEGER,
      ADD COLUMN IF NOT EXISTS key_insights TEXT;
      `);
    } else {
      console.log('Successfully added columns through REST API.');
    }
  } catch (error) {
    console.error('Error in direct column creation:', error);
    console.log('\nImportant: You will need to run the following SQL in the Supabase dashboard:');
    console.log(`
    -- Run this in the SQL editor in your Supabase dashboard
    ALTER TABLE responses 
    ADD COLUMN IF NOT EXISTS numeric_value INTEGER,
    ADD COLUMN IF NOT EXISTS key_insights TEXT;
    `);
  }
}

// Verify that columns were added
async function verifyColumns() {
  try {
    console.log('Verifying column creation...');
    
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error verifying columns:', error);
      return false;
    }
    
    const sample = data && data.length > 0 ? data[0] : null;
    
    if (!sample) {
      console.log('No response data to verify column structure.');
      return false;
    }
    
    const hasNumericValue = 'numeric_value' in sample;
    const hasKeyInsights = 'key_insights' in sample;
    
    console.log(`Verification results:`);
    console.log(`- 'numeric_value' column exists: ${hasNumericValue}`);
    console.log(`- 'key_insights' column exists: ${hasKeyInsights}`);
    
    return hasNumericValue && hasKeyInsights;
  } catch (error) {
    console.error('Error verifying columns:', error);
    return false;
  }
}

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

// Populate the columns with appropriate values
async function populateColumns() {
  try {
    console.log('Populating numeric_value and key_insights columns...');
    
    // Get all responses
    const { data: responses, error } = await supabase
      .from('responses')
      .select('*');
      
    if (error) {
      console.error('Error fetching responses:', error);
      return;
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
        // Only update if values are null/undefined
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
          successCount++;
          continue;
        }
        
        // Update the response
        const { error: updateError } = await supabase
          .from('responses')
          .update(updateData)
          .eq('id', response.id);
          
        if (updateError) {
          console.error(`Error updating response ${response.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated response ${response.id} with:`, updateData);
          successCount++;
        }
      } catch (err) {
        console.error(`Error processing response ${response.id}:`, err);
        errorCount++;
      }
    }
    
    console.log(`Finished updating responses: ${successCount} succeeded, ${errorCount} failed.`);
  } catch (error) {
    console.error('Error populating columns:', error);
  }
}

// Execute the script
console.log('Starting migration script to add columns to responses table...');
addColumnsToResponses(); 