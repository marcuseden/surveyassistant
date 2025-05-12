const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simple implementation of formatVoiceQuestion for this script
function formatVoiceQuestion(text, metadata) {
  let formattedText = text.trim();
  
  // Make sure the text ends with appropriate punctuation
  if (!formattedText.endsWith('?') && !formattedText.endsWith('.')) {
    formattedText = formattedText + '?';
  }
  
  if (!metadata || !metadata.response_type) {
    return `${formattedText} Please respond with your answer.`;
  }
  
  switch (metadata.response_type) {
    case 'Multiple-Choice':
      if (metadata.options && metadata.options.length > 0) {
        return `${formattedText} Please say one of the following: ${metadata.options.map(opt => `"${opt}"`).join(', ')}.`;
      }
      return `${formattedText} Please select one of the options.`;
      
    case 'Yes-No':
      return `${formattedText} Please say "Yes" or "No".`;
      
    case 'Numeric':
      return `${formattedText} Please say a number.`;
      
    case 'Open-Ended':
      return `${formattedText} Please tell me in your own words.`;
      
    default:
      return `${formattedText} Please respond with your answer.`;
  }
}

// Sample questions to replace the placeholders
const sampleQuestions = [
  {
    id: 'Q1',
    text: 'Do you have a primary care doctor you see regularly',
    type: 'Yes-No'
  },
  {
    id: 'Q2',
    text: 'How do you usually contact your primary care doctor',
    type: 'Multiple-Choice',
    options: ['Phone', 'Online', 'In-person', 'Email', 'Other']
  },
  {
    id: 'Q3',
    text: 'What is the biggest barrier to accessing primary care for you',
    type: 'Open-Ended'
  }
];

// Format the questions to be voice-friendly
const voiceFriendlyQuestions = sampleQuestions.map(q => {
  // Convert to the format expected by formatVoiceQuestion
  const metadata = {
    response_type: q.type,
    options: q.options
  };
  
  return {
    id: q.id,
    text: formatVoiceQuestion(q.text, metadata),
    metadata
  };
});

async function updateQuestions() {
  try {
    console.log('Updating placeholder questions with meaningful content...\n');
    
    // Get all questions to find IDs
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    if (!questions || questions.length === 0) {
      console.log('No questions found in database.');
      return;
    }
    
    console.log(`Found ${questions.length} questions in the database.`);
    
    // Update the first 3 questions with our sample data
    for (let i = 0; i < Math.min(3, questions.length); i++) {
      const questionToUpdate = questions[i];
      const sampleQuestion = voiceFriendlyQuestions[i];
      
      if (!sampleQuestion) continue;
      
      console.log(`\nUpdating question "${questionToUpdate.question_text}" with:`);
      console.log(`New text: ${sampleQuestion.text}`);
      
      const { error: updateError } = await supabase
        .from('questions')
        .update({ 
          question_text: sampleQuestion.text
        })
        .eq('id', questionToUpdate.id);
      
      if (updateError) {
        console.error(`Error updating question ${questionToUpdate.id}:`, updateError);
      } else {
        console.log(`✓ Successfully updated question ${i+1}`);
      }
    }
    
    console.log('\nUpdates complete! The first three questions now have voice-friendly text.');
    
    // Now print the updated questions
    console.log('\nRetrieving updated questions:');
    const { data: updatedQuestions, error: fetchError } = await supabase
      .from('questions')
      .select('question_text')
      .order('created_at', { ascending: true })
      .limit(3);
      
    if (fetchError) {
      console.error('Error fetching updated questions:', fetchError);
    } else {
      updatedQuestions.forEach((q, index) => {
        console.log(`\nQuestion ${index + 1}: ${q.question_text}`);
      });
    }
    
  } catch (error) {
    console.error('Error updating questions:', error);
  }
}

updateQuestions(); 