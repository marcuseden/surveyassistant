// Script to generate dummy survey responses
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

// Configuration
const NUM_DUMMY_RESPONSES = 10; // Number of complete response sets to generate
const SURVEY_ID = process.argv[2]; // Get the survey ID from command line args

// Dummy response templates for different question types
const numericResponses = [
  "5", "4", "3", "5", "4", "2", "1", "5", "3", "4", 
  "I'd say about 4", "Definitely a 5", "Maybe a 3", "2 out of 5", "I give it a 4",
  "five", "four", "three", "four", "five"
];

const yesNoResponses = [
  "Yes", "No", "Definitely", "Absolutely", "Not really", 
  "Of course", "Probably not", "I think so", "Not at all", "For sure"
];

const feedbackResponses = [
  "The service was excellent", 
  "I was very satisfied with my experience",
  "Could have been better, but overall good",
  "The staff was friendly but the wait time was long",
  "I was impressed with how efficient everything was",
  "They helped resolve my issue quickly",
  "I would recommend this to others",
  "The process was confusing at times",
  "Very professional and helpful staff",
  "I had trouble understanding some of the instructions"
];

// Random selection helper
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate a random date within the last month
function getRandomDate() {
  const now = new Date();
  const pastDate = new Date(now);
  pastDate.setDate(now.getDate() - Math.floor(Math.random() * 30));
  return pastDate.toISOString();
}

// Extract numeric value from text responses
function extractNumericValue(text) {
  // First try to match a simple digit
  const digitMatch = text.match(/\b([0-9]|10)\b/);
  if (digitMatch) {
    return parseInt(digitMatch[1]);
  }
  
  // Then try to match words for numbers
  const wordMap = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };
  
  const lowerText = text.toLowerCase();
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
  
  return Math.floor(Math.random() * 5) + 1; // Fallback to random 1-5
}

// Determine question type from question text
function inferQuestionType(questionText) {
  const lowerText = questionText.toLowerCase();
  
  // Check for numeric rating questions
  if (lowerText.includes('scale') || 
      lowerText.includes('rate') || 
      lowerText.includes('rating') || 
      lowerText.includes('1-5') || 
      lowerText.includes('1 to 5') ||
      lowerText.includes('satisfaction')) {
    return 'numeric';
  }
  
  // Check for yes/no questions
  if (lowerText.includes('did you') || 
      lowerText.includes('do you') || 
      lowerText.includes('would you') || 
      lowerText.includes('have you') ||
      lowerText.includes('yes or no') ||
      lowerText.endsWith('?')) {
    return 'yes_no';
  }
  
  // Default to feedback for longer form questions
  return 'feedback';
}

// Main function to generate and store dummy responses
async function generateDummyResponses() {
  try {
    // Validate survey ID
    if (!SURVEY_ID) {
      console.error('Please provide a survey ID as the first argument');
      process.exit(1);
    }
    
    console.log(`Generating ${NUM_DUMMY_RESPONSES} sets of dummy responses for survey ${SURVEY_ID}`);
    
    // Get survey details
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', SURVEY_ID)
      .single();
      
    if (surveyError) {
      console.error('Error fetching survey:', surveyError);
      process.exit(1);
    }
    
    console.log(`Found survey: ${surveyData.name}`);
    
    // Get questions for this survey
    const { data: surveyQuestions, error: questionsError } = await supabase
      .from('survey_questions')
      .select('id, question_id, order')
      .eq('survey_id', SURVEY_ID)
      .order('order');
      
    if (questionsError) {
      console.error('Error fetching survey questions:', questionsError);
      process.exit(1);
    }
    
    if (!surveyQuestions || surveyQuestions.length === 0) {
      console.error('No questions found for this survey');
      process.exit(1);
    }
    
    console.log(`Found ${surveyQuestions.length} questions in the survey`);
    
    // Get actual question texts
    const questionIds = surveyQuestions.map(q => q.question_id);
    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('id', questionIds);
      
    if (questionError) {
      console.error('Error fetching question texts:', questionError);
      process.exit(1);
    }
    
    // Create a map of question types based on question text
    const questionMap = {};
    questionData.forEach(q => {
      const questionType = inferQuestionType(q.question_text);
      questionMap[q.id] = { 
        text: q.question_text, 
        type: questionType 
      };
      console.log(`Question: "${q.question_text.substring(0, 50)}..." - Type: ${questionType}`);
    });
    
    // Get some existing phone numbers from the phone_list table
    const { data: phoneData, error: phoneError } = await supabase
      .from('phone_list')
      .select('id, phone_number, name')
      .limit(NUM_DUMMY_RESPONSES);
      
    if (phoneError) {
      console.error('Error fetching phone numbers:', phoneError);
      process.exit(1);
    }
    
    if (!phoneData || phoneData.length === 0) {
      console.error('No phone numbers found in the database');
      
      // Creating dummy phone numbers
      console.log('Creating dummy phone numbers...');
      const dummyPhones = [];
      
      for (let i = 0; i < 5; i++) {
        const phoneNumber = `+1${Math.floor(Math.random() * 900 + 100)}${Math.floor(Math.random() * 900 + 100)}${Math.floor(Math.random() * 10000)}`;
        const { data: newPhone, error: newPhoneError } = await supabase
          .from('phone_list')
          .insert({
            phone_number: phoneNumber,
            name: `Test User ${i+1}`
          })
          .select()
          .single();
          
        if (newPhoneError) {
          console.error(`Error creating dummy phone number:`, newPhoneError);
        } else {
          console.log(`Created dummy phone: ${newPhone.phone_number}`);
          dummyPhones.push(newPhone);
        }
      }
      
      if (dummyPhones.length === 0) {
        console.error('Could not create dummy phone numbers');
        process.exit(1);
      }
      
      phoneData = dummyPhones;
    }
    
    // Generate dummy responses
    for (let i = 0; i < NUM_DUMMY_RESPONSES; i++) {
      const phoneEntry = phoneData[i % phoneData.length];
      
      // Create a call queue entry
      const callDate = getRandomDate();
      const callSid = `DUMMY_CALL_${Date.now()}_${i}`;
      
      const { data: queueEntry, error: queueError } = await supabase
        .from('call_queue')
        .insert({
          phone_list_id: phoneEntry.id,
          survey_id: SURVEY_ID,
          call_sid: callSid,
          status: 'completed',
          call_status: 'completed',
          attempt_count: 1,
          created_at: callDate,
          last_attempt_at: callDate
        })
        .select()
        .single();
        
      if (queueError) {
        console.error(`Error creating call queue entry for response set ${i}:`, queueError);
        continue;
      }
      
      console.log(`Created call queue entry ${queueEntry.id} for phone ${phoneEntry.phone_number}`);
      
      // Create responses for each question
      const responses = {};
      
      for (const question of surveyQuestions) {
        const questionInfo = questionMap[question.question_id];
        let responseText;
        
        // Generate appropriate response based on question type
        if (questionInfo.type === 'numeric') {
          responseText = getRandomElement(numericResponses);
        } else if (questionInfo.type === 'yes_no') {
          responseText = getRandomElement(yesNoResponses);
        } else {
          responseText = getRandomElement(feedbackResponses);
        }
        
        // Extract numeric value
        const numericValue = extractNumericValue(responseText);
        
        // Save to responses table
        const { error: responseError } = await supabase
          .from('responses')
          .insert({
            phone_list_id: phoneEntry.id,
            question_id: question.question_id,
            answer_text: responseText,
            created_at: callDate
          });
          
        if (responseError) {
          console.error(`Error creating response for question ${question.question_id}:`, responseError);
        } else {
          console.log(`Created response for question ${question.question_id}: "${responseText}" (${numericValue})`);
        }
        
        // Add to responses object for call_queue
        responses[question.question_id] = responseText;
      }
      
      // Update call queue with responses
      const { error: updateError } = await supabase
        .from('call_queue')
        .update({
          responses: responses
        })
        .eq('id', queueEntry.id);
        
      if (updateError) {
        console.error(`Error updating call queue with responses:`, updateError);
      } else {
        console.log(`Updated call queue ${queueEntry.id} with ${Object.keys(responses).length} responses`);
      }
      
      console.log(`Completed response set ${i+1}/${NUM_DUMMY_RESPONSES}`);
    }
    
    console.log('Finished generating dummy responses');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

generateDummyResponses(); 