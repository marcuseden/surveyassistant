import { createClient } from '@supabase/supabase-js';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Make sure we have required variables for Supabase
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Supabase credentials are missing. Check your .env.local file.');
  throw new Error('Supabase credentials missing');
}

console.log('FORCE: Using REAL Supabase client with no mock option');

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Export types
export type PhoneList = {
  id: string;
  phone_number: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  question_text: string;
  is_follow_up: boolean;
  parent_question_id: string | null;
  metadata?: {
    question_id?: string;
    section?: string;
    response_type?: string;
    options?: string[];
    follow_up_trigger?: string;
    follow_up_text?: string;
  };
  created_at: string;
  updated_at: string;
};

export type Survey = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestion = {
  id: string;
  survey_id: string;
  question_id: string;
  "order": number;
  created_at: string;
  updated_at: string;
};

export type Response = {
  id: string;
  phone_list_id: string;
  question_id: string;
  answer_text: string;
  numeric_value: number | null;
  key_insights: string;
  recorded_at: string;
  created_at: string;
};

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  updated_at: string | null;
}; 