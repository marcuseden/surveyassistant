// Script to consolidate call queue entries for the same phone number and survey
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

async function main() {
  try {
    console.log('Starting call queue consolidation...');
    
    // Get all call queue entries
    const { data: allEntries, error: fetchError } = await supabase
      .from('call_queue')
      .select('*')
      .order('created_at', { ascending: true });
      
    if (fetchError) {
      console.error('Error fetching call queue entries:', fetchError);
      return;
    }
    
    console.log(`Found ${allEntries.length} total call queue entries`);
    
    // Group entries by phone_list_id and survey_id
    const groupedEntries = {};
    allEntries.forEach(entry => {
      const key = `${entry.phone_list_id}_${entry.survey_id}`;
      if (!groupedEntries[key]) {
        groupedEntries[key] = [];
      }
      groupedEntries[key].push(entry);
    });
    
    console.log(`Found ${Object.keys(groupedEntries).length} unique phone/survey combinations`);
    
    // Process each group
    for (const [key, entries] of Object.entries(groupedEntries)) {
      if (entries.length <= 1) {
        console.log(`Skipping ${key} - only one entry`);
        continue;
      }
      
      console.log(`Processing ${key} - ${entries.length} entries`);
      
      // Sort by created_at (oldest first)
      entries.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      // Keep the oldest entry and update it
      const oldestEntry = entries[0];
      const totalAttempts = entries.reduce((sum, entry) => sum + (entry.attempt_count || 1), 0);
      const latestAttempt = entries.reduce((latest, entry) => {
        const attemptDate = new Date(entry.last_attempt_at || entry.created_at);
        return attemptDate > latest ? attemptDate : latest;
      }, new Date(0));
      
      // Get the latest call SID
      const latestEntry = entries.reduce((latest, entry) => {
        const entryDate = new Date(entry.created_at);
        const latestDate = new Date(latest.created_at);
        return entryDate > latestDate ? entry : latest;
      }, entries[0]);
      
      console.log(`Updating entry ${oldestEntry.id} with ${totalAttempts} total attempts`);
      console.log(`Latest attempt: ${latestAttempt.toISOString()}`);
      
      // Update the oldest entry with consolidated information
      const { error: updateError } = await supabase
        .from('call_queue')
        .update({
          attempt_count: totalAttempts,
          last_attempt_at: latestAttempt.toISOString(),
          call_sid: latestEntry.call_sid,
          call_status: latestEntry.call_status || 'completed',
          voice_option: latestEntry.voice_option
        })
        .eq('id', oldestEntry.id);
        
      if (updateError) {
        console.error(`Error updating entry ${oldestEntry.id}:`, updateError);
        continue;
      }
      
      // Delete the other entries
      const idsToDelete = entries.slice(1).map(entry => entry.id);
      console.log(`Deleting ${idsToDelete.length} duplicate entries`);
      
      const { error: deleteError } = await supabase
        .from('call_queue')
        .delete()
        .in('id', idsToDelete);
        
      if (deleteError) {
        console.error('Error deleting duplicate entries:', deleteError);
      }
    }
    
    console.log('Call queue consolidation completed successfully');
    
    // Verify the results
    const { data: finalEntries, error: finalError } = await supabase
      .from('call_queue')
      .select('*');
      
    if (finalError) {
      console.error('Error fetching final call queue entries:', finalError);
      return;
    }
    
    console.log(`Final call queue count: ${finalEntries.length} entries`);
    
  } catch (error) {
    console.error('Unexpected error during consolidation:', error);
  }
}

main()
  .catch(err => {
    console.error('Top-level error:', err);
  })
  .finally(() => {
    console.log('Script execution completed');
  }); 