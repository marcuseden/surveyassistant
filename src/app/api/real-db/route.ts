import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/forceRealClient';

export async function GET() {
  try {
    // Test the real database connection
    const { data: surveys, error: surveysError } = await supabase
      .from('surveys')
      .select('*');
    
    if (surveysError) {
      return NextResponse.json({ error: 'Failed to fetch surveys', details: surveysError }, { status: 500 });
    }
    
    // Get questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*');
    
    if (questionsError) {
      return NextResponse.json({ error: 'Failed to fetch questions', details: questionsError }, { status: 500 });
    }
    
    // Get phone list
    const { data: phoneList, error: phoneError } = await supabase
      .from('phone_list')
      .select('*');
    
    if (phoneError) {
      return NextResponse.json({ error: 'Failed to fetch phone list', details: phoneError }, { status: 500 });
    }
    
    return NextResponse.json({
      message: 'Real database connection successful',
      surveys,
      questions,
      phoneList,
      tables: {
        surveys: surveys.length,
        questions: questions.length,
        phoneList: phoneList.length
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 