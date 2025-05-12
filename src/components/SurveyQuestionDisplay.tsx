import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/forceRealClient';

interface SurveyQuestionDisplayProps {
  questionId: string;
  index?: number;
  surveyId?: string;
}

export default function SurveyQuestionDisplay({ 
  questionId, 
  index, 
  surveyId 
}: SurveyQuestionDisplayProps) {
  const [questionText, setQuestionText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuestionText() {
      if (!questionId) {
        setQuestionText('Question ID not provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('questions')
          .select('question_text, metadata')
          .eq('id', questionId)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setQuestionText(data.question_text);
          
          // Display additional metadata if available
          if (data.metadata) {
            // You could add more context here if needed
          }
        } else {
          setQuestionText('Question not found');
        }
      } catch (err) {
        console.error('Error fetching question:', err);
        setError('Failed to load question');
        setQuestionText('Error loading question');
      } finally {
        setLoading(false);
      }
    }

    fetchQuestionText();
  }, [questionId]);

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading question...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm">{error}</div>;
  }

  return (
    <div className="question-display">
      {index !== undefined && (
        <span className="font-medium mr-2">{index + 1}.</span>
      )}
      <span className="question-text">{questionText}</span>
    </div>
  );
} 