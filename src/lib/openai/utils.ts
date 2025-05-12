import { supabase } from '../supabase/client';
import { USE_MOCK_OPENAI } from '../db-config';

// Check if we have an OpenAI API key, use mock if not or if explicitly configured
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const usingMockApi = USE_MOCK_OPENAI || openaiApiKey === 'dummy_key' || !openaiApiKey;

/**
 * Generate a follow-up question based on the original question and the answer
 */
export async function generateFollowUpQuestion(
  originalQuestion: string,
  answer: string
): Promise<string> {
  try {
    if (usingMockApi) {
      console.log('Using mock OpenAI API for development');
      return generateMockFollowUpQuestion(originalQuestion, answer);
    }
    
    // Call the OpenAI API to generate a follow-up question
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an assistant that generates follow-up questions for a survey. Generate a single follow-up question based on the original question and the answer provided. Make it personal, insightful, and engaging.'
          },
          {
            role: 'user',
            content: `Original question: "${originalQuestion}"\nAnswer: "${answer}"\nGenerate a follow-up question:`
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to generate follow-up question');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating follow-up question:', error);
    return 'Could you tell me more about that?';
  }
}

/**
 * Save a follow-up question to the database
 */
export async function saveFollowUpQuestion(
  parentQuestionId: string,
  followUpQuestionText: string
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('questions')
      .insert({
        question_text: followUpQuestionText,
        is_follow_up: true,
        parent_question_id: parentQuestionId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving follow-up question:', error);
    throw error;
  }
}

/**
 * Extract numeric rating from answer when applicable
 */
export async function extractNumericValue(
  questionText: string,
  answerText: string
): Promise<number | null> {
  try {
    if (usingMockApi) {
      return extractMockNumericValue(questionText, answerText);
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You analyze survey responses to extract numeric values. If the response contains a rating or a numeric answer (like "8 out of 10" or "I rate it a 7"), extract just the number. For questions with specific options like "No impact" to "Severe impact", map them to a scale where No impact=1, Minor impact=2, Moderate impact=3, Severe impact=4. For yes/no questions, map Yes=1, No=0. For ranges like "18 to 24", return the average (21). If no numeric value is present or applicable, return null.'
          },
          {
            role: 'user',
            content: `Question: "${questionText}"\nAnswer: "${answerText}"\nExtract numeric value:`
          }
        ],
        temperature: 0,
        max_tokens: 10
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to extract numeric value');
    }

    const result = data.choices[0].message.content.trim();
    
    // Try to parse the result as a number
    if (result.toLowerCase() === 'null' || result === '') {
      return null;
    }
    
    const numValue = parseFloat(result);
    return isNaN(numValue) ? null : numValue;
  } catch (error) {
    console.error('Error extracting numeric value:', error);
    return null;
  }
}

/**
 * Extract key insights from qualitative answers
 */
export async function extractKeyInsights(
  questionText: string,
  answerText: string
): Promise<string> {
  try {
    if (usingMockApi) {
      return extractMockKeyInsights(questionText, answerText);
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You analyze survey responses to extract key insights. Summarize the most important points in the response, focusing on specific details, pain points, or suggestions. Keep it concise and factual, highlighting what would be most useful for quantitative analysis. Limit to 1-2 sentences maximum.'
          },
          {
            role: 'user',
            content: `Question: "${questionText}"\nAnswer: "${answerText}"\nExtract key insights:`
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to extract key insights');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error extracting key insights:', error);
    return 'No key insights extracted';
  }
}

/**
 * Process a full survey response into structured data
 */
export async function processSurveyResponse(
  questionId: string,
  answerText: string
): Promise<{
  numeric_value: number | null;
  key_insights: string;
  processed_at: string;
}> {
  try {
    // Get the question text
    const { data: question } = await supabase
      .from('questions')
      .select('question_text')
      .eq('id', questionId)
      .single();
    
    if (!question) {
      throw new Error('Question not found');
    }
    
    // Extract numeric value and key insights
    const [numericValue, keyInsights] = await Promise.all([
      extractNumericValue(question.question_text, answerText),
      extractKeyInsights(question.question_text, answerText)
    ]);
    
    return {
      numeric_value: numericValue,
      key_insights: keyInsights,
      processed_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error processing survey response:', error);
    return {
      numeric_value: null,
      key_insights: 'Error processing response',
      processed_at: new Date().toISOString()
    };
  }
}

/**
 * Generate a mock follow-up question for development
 */
function generateMockFollowUpQuestion(originalQuestion: string, answer: string): string {
  // A set of generic follow-up questions that could work for many scenarios
  const genericFollowUps = [
    "Can you tell me more about why you feel that way?",
    "How has that experience affected your overall healthcare decisions?",
    "What specific improvements would you suggest based on your experience?",
    "Could you elaborate on the most significant aspect of this issue for you?",
    "How does this compare to your experiences in the past?",
    "What impact has this had on your daily life?",
    "What would an ideal solution look like from your perspective?",
    "Have you found any workarounds or alternatives that have helped?",
    "How urgent do you feel this issue is to address?",
    "Is there anything else you'd like to add about this topic?"
  ];
  
  // Randomly select a follow-up question
  const randomIndex = Math.floor(Math.random() * genericFollowUps.length);
  return genericFollowUps[randomIndex];
}

/**
 * Extract mock numeric values for development
 */
function extractMockNumericValue(questionText: string, answerText: string): number | null {
  // Look for specific patterns in the question to determine what kind of value to return
  const questionLower = questionText.toLowerCase();
  
  // Scale questions (1-5, 1-10)
  if (questionLower.includes('scale') || questionLower.includes('rate')) {
    return Math.floor(Math.random() * 5) + 1; // Random 1-5
  }
  
  // Yes/No questions
  if (questionLower.includes('yes') || questionLower.includes('no')) {
    return Math.random() > 0.5 ? 1 : 0; // Random 0 or 1
  }
  
  // Impact questions
  if (questionLower.includes('impact')) {
    return Math.floor(Math.random() * 4) + 1; // Random 1-4
  }
  
  // Age groups
  if (questionLower.includes('age')) {
    const ageGroups = [21, 29.5, 39.5, 49.5, 59.5, 70];
    return ageGroups[Math.floor(Math.random() * ageGroups.length)];
  }
  
  // Default to null for qualitative questions
  return null;
}

/**
 * Extract mock key insights for development
 */
function extractMockKeyInsights(questionText: string, answerText: string): string {
  const insights = [
    "Patient reports difficulty scheduling appointments due to limited availability.",
    "Long wait times were identified as the primary barrier to access.",
    "Patient uses telehealth regularly and finds it convenient despite occasional technical issues.",
    "Cost concerns prevented patient from seeking necessary care, resulting in condition worsening.",
    "Transportation challenges significantly impact ability to receive regular care.",
    "Patient suggests extended hours would greatly improve their access to care.",
    "Online scheduling system described as confusing and difficult to navigate.",
    "Wait times of 2+ weeks for appointments were reported as problematic for urgent issues.",
    "Patient switched doctors multiple times due to insurance network changes.",
    "Rural location creates significant distance barriers to accessing specialists."
  ];
  
  // Return a random insight
  return insights[Math.floor(Math.random() * insights.length)];
} 