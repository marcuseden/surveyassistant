import { createClient } from '@supabase/supabase-js';
import { USE_MOCK_DB } from '../db-config';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Make sure we have required variables for Supabase
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials are missing. Please check your environment variables.');
}

// Log status to console
if (!USE_MOCK_DB) {
  console.log('Using REAL Supabase client');
} else {
  console.error('Mock DB is enabled but should not be used!');
}

// Types for our database tables
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

// Add user types for authentication
export type User = {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
};

export type CallQueue = {
  id: string;
  phone_list_id: string;
  survey_id: string;
  call_sid?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'abandoned';
  attempt_count: number;
  last_attempt_at?: string;
  next_attempt_at?: string;
  created_at: string;
  updated_at: string;
  call_duration?: number;
  call_status?: string;
  voice_option?: string;
  language_option?: string;
  responses?: Record<string, any>;
  error_message?: string;
  notes?: string;
};

// Create the Supabase client - a single source of truth
export const db = createClient(supabaseUrl, supabaseAnonKey);

// Check if we're using a mock client for tests
if (typeof window !== 'undefined') {
  if (process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true') {
    console.log('Using MOCK Supabase client on client-side');
  } else {
    console.log('Using REAL Supabase client in client.ts');
  }
} 