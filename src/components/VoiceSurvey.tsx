'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/supabase/db';
import type { Survey, Question, SurveyQuestion } from '@/lib/supabase/db';

interface VoiceSurveyProps {
  surveyId?: string;
}

export default function VoiceSurvey({ surveyId }: VoiceSurveyProps) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Conversation state
  const [isStarted, setIsStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentResponse, setCurrentResponse] = useState('');
  
  // Load initial data
  useEffect(() => {
    fetchSurveys();
  }, []);
  
  // Effect to load questions when survey is selected
  useEffect(() => {
    if (selectedSurvey) {
      fetchQuestions(selectedSurvey.id);
    }
  }, [selectedSurvey]);
  
  // Set initial survey if surveyId is provided
  useEffect(() => {
    if (surveyId && surveys.length > 0) {
      const survey = surveys.find(s => s.id === surveyId);
      if (survey) {
        setSelectedSurvey(survey);
      }
    }
  }, [surveyId, surveys]);

  // Fetch all available surveys
  async function fetchSurveys() {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await db
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setSurveys(data || []);
      
      // Auto-select first survey if none is provided
      if (data && data.length > 0 && !surveyId) {
        setSelectedSurvey(data[0]);
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
      setError('Failed to load surveys. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  // Fetch questions for a specific survey
  async function fetchQuestions(surveyId: string) {
    setLoading(true);
    setError(null);
    
    try {
      // Get survey questions with their order
      const { data: surveyQuestionsData, error: surveyQuestionsError } = await db
        .from('survey_questions')
        .select('*, question_id')
        .eq('survey_id', surveyId)
        .order('"order"', { ascending: true });
      
      if (surveyQuestionsError) throw surveyQuestionsError;
      
      if (!surveyQuestionsData || surveyQuestionsData.length === 0) {
        setQuestions([]);
        setError('No questions found for this survey.');
        setLoading(false);
        return;
      }
      
      // Get the full question data for each question ID
      const questionIds = surveyQuestionsData.map(sq => sq.question_id);
      
      const { data: questionsData, error: questionsError } = await db
        .from('questions')
        .select('*')
        .in('id', questionIds);
      
      if (questionsError) throw questionsError;
      
      // Sort questions according to the survey_questions order
      const orderedQuestions = questionIds
        .map(id => questionsData?.find(q => q.id === id))
        .filter(q => q) as Question[];
      
      setQuestions(orderedQuestions);
      
      // Reset survey progress
      setCurrentQuestionIndex(0);
      setResponses({});
      setCurrentResponse('');
    } catch (error) {
      console.error('Error fetching questions:', error);
      setError('Failed to load survey questions.');
    } finally {
      setLoading(false);
    }
  }
  
  // Start the survey
  function startSurvey() {
    if (questions.length === 0) {
      setError('No questions available for this survey.');
      return;
    }
    
    setIsStarted(true);
    setCurrentQuestionIndex(0);
    setResponses({});
  }
  
  // Handle response submission
  function handleResponseSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!currentResponse.trim()) {
      return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    
    // Save response
    setResponses({
      ...responses,
      [currentQuestion.id]: currentResponse
    });
    
    // Clear current response
    setCurrentResponse('');
    
    // Move to next question or finish
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Survey completed
      handleSurveyComplete();
    }
  }
  
  // Save survey responses to database
  async function handleSurveyComplete() {
    if (!selectedSurvey) return;
    
    setLoading(true);
    
    try {
      // Convert responses to array format for database insert
      const responsesToSave = Object.entries(responses).map(([questionId, answer]) => ({
        question_id: questionId,
        answer_text: answer,
        recorded_at: new Date().toISOString()
      }));
      
      // Save responses
      const { error } = await db
        .from('responses')
        .insert(responsesToSave);
      
      if (error) throw error;
      
      setIsStarted(false);
      setCurrentQuestionIndex(0);
      setResponses({});
      
      // Show success message
      setError(null);
      alert('Survey completed! Thank you for your responses.');
    } catch (error) {
      console.error('Error saving responses:', error);
      setError('Failed to save responses. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  // Optimize question text for voice
  function prepareQuestionText(question: Question): string {
    let text = question.question_text;
    
    // If it's already in a voice-friendly format, just return it
    if (text.includes('Please say') || text.includes('please tell')) {
      return text;
    }
    
    // Check metadata for response type and options
    const responseType = question.metadata?.response_type;
    const options = question.metadata?.options;
    
    // Add voice prompts based on response type
    if (responseType === 'Multiple-Choice' && options && options.length > 0) {
      text += ` Please say one of the following: ${options.map(opt => `"${opt}"`).join(', ')}.`;
    } else if (responseType === 'Yes-No') {
      text += ` Please say "Yes" or "No".`;
    } else if (responseType === 'Numeric') {
      text += ` Please say a number.`;
    } else if (responseType === 'Open-Ended') {
      text += ` Please tell me in your own words.`;
    } else {
      // Generic suffix for any other question
      text += ` Please respond with your answer.`;
    }
    
    return text;
  }
  
  // Loading state
  if (loading && !isStarted) {
    return <div className="flex items-center justify-center min-h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {!isStarted && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Voice Survey</h2>
          
          {!selectedSurvey && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select a Survey
              </label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => {
                  const surveyId = e.target.value;
                  const survey = surveys.find(s => s.id === surveyId);
                  setSelectedSurvey(survey || null);
                }}
                value={selectedSurvey?.id || ''}
              >
                <option value="">-- Select Survey --</option>
                {surveys.map(survey => (
                  <option key={survey.id} value={survey.id}>
                    {survey.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {selectedSurvey && (
            <div>
              <div className="mb-4">
                <h3 className="text-xl font-semibold">{selectedSurvey.name}</h3>
                <p className="text-gray-600 mt-1">{selectedSurvey.description}</p>
                
                <div className="mt-4 text-sm text-gray-600">
                  <p>This survey contains {questions.length} questions optimized for voice conversation.</p>
                </div>
              </div>
              
              <button
                onClick={startSurvey}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={loading || questions.length === 0}
              >
                Start Voice Survey
              </button>
            </div>
          )}
        </div>
      )}
      
      {isStarted && currentQuestionIndex < questions.length && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
            
            <h3 className="text-xl font-medium text-gray-800">
              {prepareQuestionText(questions[currentQuestionIndex])}
            </h3>
          </div>
          
          <form onSubmit={handleResponseSubmit} className="mt-6">
            <label htmlFor="response" className="sr-only">Your response</label>
            <textarea
              id="response"
              value={currentResponse}
              onChange={(e) => setCurrentResponse(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20"
              placeholder="Type your response here..."
              required
            />
            
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={() => {
                  if (currentQuestionIndex > 0) {
                    setCurrentQuestionIndex(currentQuestionIndex - 1);
                    setCurrentResponse(responses[questions[currentQuestionIndex - 1].id] || '');
                  }
                }}
                className="py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </button>
              
              <button
                type="submit"
                className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next' : 'Finish'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
} 