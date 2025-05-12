import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: Request) {
  try {
    // Get surveyId from query parameter
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');
    
    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      );
    }
    
    // Check if we can query for numeric_value
    let hasNumericValueColumn = true;
    let hasKeyInsightsColumn = true;
    
    try {
      // Test query to see if column exists
      await supabase
        .from('responses')
        .select('numeric_value')
        .limit(1);
    } catch (e: any) {
      // If error contains "column does not exist", mark it as not available
      if (e.message && e.message.includes('column "numeric_value" does not exist')) {
        hasNumericValueColumn = false;
      }
    }
    
    try {
      // Test query to see if column exists
      await supabase
        .from('responses')
        .select('key_insights')
        .limit(1);
    } catch (e: any) {
      // If error contains "column does not exist", mark it as not available
      if (e.message && e.message.includes('column "key_insights" does not exist')) {
        hasKeyInsightsColumn = false;
      }
    }
    
    // Get all questions for this survey using survey_questions table
    const { data: surveyQuestions, error: surveyQuestionsError } = await supabase
      .from('survey_questions')
      .select('question_id, order')
      .eq('survey_id', surveyId)
      .order('order', { ascending: true });

    if (surveyQuestionsError) {
      throw surveyQuestionsError;
    }
    
    if (!surveyQuestions || surveyQuestions.length === 0) {
      return NextResponse.json(
        { error: 'No questions found for this survey' },
        { status: 404 }
      );
    }
    
    // Get question IDs for this survey
    const questionIds = surveyQuestions.map(sq => sq.question_id);
    
    // Get question details
    const { data: questions, error: questionDetailsError } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('id', questionIds);
      
    if (questionDetailsError) {
      throw questionDetailsError;
    }
    
    // Sort questions according to the survey order
    const sortedQuestions = questionIds.map(qId => 
      questions.find(q => q.id === qId)
    ).filter(Boolean);

    // Build select query based on available columns
    let selectQuery = 'id, question_id, answer_text, recorded_at, phone_list_id';
    if (hasNumericValueColumn) {
      selectQuery += ', numeric_value';
    }
    if (hasKeyInsightsColumn) {
      selectQuery += ', key_insights';
    }

    // Get all responses for questions in this survey
    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select(selectQuery)
      .in('question_id', questionIds);

    if (responsesError) {
      throw responsesError;
    }
    
    // Get survey details
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('name, description')
      .eq('id', surveyId)
      .single();
      
    if (surveyError) {
      console.warn('Error fetching survey details:', surveyError);
    }

    // Structure the data for analysis
    const analytics = {
      survey: {
        id: surveyId,
        name: surveyData?.name || 'Unknown Survey',
        description: surveyData?.description || '',
        questionCount: sortedQuestions.length
      },
      questionBreakdown: sortedQuestions.map(question => {
        // Filter responses for this question
        const questionResponses = responses.filter(r => r.question_id === question.id);
        
        // Calculate numeric stats if we have the column
        let numericStats = {
          count: 0,
          avg: null,
          distribution: {}
        };
        
        if (hasNumericValueColumn) {
          const numericValues = questionResponses
            .map(r => r.numeric_value)
            .filter(val => val !== null) as number[];
          
          const count = numericValues.length;
          const sum = numericValues.reduce((acc, val) => acc + val, 0);
          const avg = count > 0 ? (sum / count) : null;
          
          // Calculate distribution
          const distribution: Record<string, number> = {};
          numericValues.forEach(val => {
            distribution[val] = (distribution[val] || 0) + 1;
          });
          
          numericStats = {
            count,
            avg: avg !== null ? parseFloat(avg.toFixed(2)) : null,
            distribution
          };
        }
        
        // Extract key insights if we have the column
        let insights: string[] = [];
        if (hasKeyInsightsColumn) {
          insights = questionResponses
            .filter(r => r.key_insights)
            .map(r => r.key_insights)
            .slice(0, 5); // Just get the top 5 insights
        }
        
        return {
          questionId: question.id,
          questionText: question.question_text,
          responseCount: questionResponses.length,
          numericStats,
          insights,
        };
      }),
      
      overallStats: {
        totalResponses: responses.length,
        responsesWithNumericValue: hasNumericValueColumn ? 
          responses.filter(r => r.numeric_value !== null).length : 0,
        responsesWithInsights: hasKeyInsightsColumn ? 
          responses.filter(r => r.key_insights).length : 0,
        responsesByDate: groupResponsesByDate(responses),
        columnsStatus: {
          hasNumericValueColumn,
          hasKeyInsightsColumn
        }
      }
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', details: error },
      { status: 500 }
    );
  }
}

// Helper function to group responses by date
function groupResponsesByDate(responses: any[]) {
  const dateGroups: Record<string, number> = {};
  
  responses.forEach(response => {
    // Extract just the date part (YYYY-MM-DD)
    const date = new Date(response.recorded_at).toISOString().split('T')[0];
    dateGroups[date] = (dateGroups[date] || 0) + 1;
  });
  
  // Convert to array of objects for easier handling in frontend
  return Object.entries(dateGroups).map(([date, count]) => ({ date, count }));
} 