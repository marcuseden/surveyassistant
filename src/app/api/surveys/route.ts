import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  try {
    // Fetch all surveys
    const { data: surveys, error } = await supabase
      .from('surveys')
      .select('id, name, description, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching surveys:', error);
      return NextResponse.json(
        { error: 'Failed to fetch surveys' },
        { status: 500 }
      );
    }
    
    // Count questions for each survey
    const surveysWithQuestionCount = await Promise.all(
      surveys.map(async (survey) => {
        const { count, error: countError } = await supabase
          .from('survey_questions')
          .select('*', { count: 'exact', head: true })
          .eq('survey_id', survey.id);
          
        if (countError) {
          console.warn(`Error counting questions for survey ${survey.id}:`, countError);
        }
        
        return {
          ...survey,
          questionCount: count || 0
        };
      })
    );
    
    return NextResponse.json({
      surveys: surveysWithQuestionCount
    });
  } catch (error) {
    console.error('Error in surveys endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 