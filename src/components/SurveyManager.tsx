'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/forceRealClient';
import type { Survey, Question, SurveyQuestion } from '@/lib/supabase/forceRealClient';
import QuestionImporter from './QuestionImporter';
import { validateVoiceQuestion, suggestVoiceImprovements, formatVoiceQuestion } from '@/lib/utils/voiceFormatter';

interface SurveyManagerProps {
  onSurveyUpdated?: () => void;
}

// Helper function to create sample Primary Care Access Survey
async function createSampleSurvey() {
  // First check if we already have a Primary Care survey
  const { data: existingSurveys } = await supabase
    .from('surveys')
    .select('id')
    .eq('name', 'Primary Care Access Survey');
    
  if (existingSurveys && existingSurveys.length > 0) {
    return existingSurveys[0].id;
  }
  
  // Create the survey
  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .insert({
      name: 'Primary Care Access Survey',
      description: 'A comprehensive survey about primary care access, barriers, and impacts on health and quality of life'
    })
    .select()
    .single();
    
  if (surveyError) {
    console.error('Error creating sample survey:', surveyError);
    return null;
  }
  
  // Get all questions
  const { data: questions } = await supabase
    .from('questions')
    .select('id');
    
  if (!questions || questions.length === 0) {
    console.log('No questions found to add to survey');
    return survey.id;
  }
  
  // Add questions to the survey
  const surveyQuestions = questions.map((question, index) => ({
    survey_id: survey.id,
    question_id: question.id,
    "order": index + 1
  }));
  
  const { error: sqError } = await supabase
    .from('survey_questions')
    .insert(surveyQuestions);
    
  if (sqError) {
    console.error('Error adding questions to survey:', sqError);
  }
  
  return survey.id;
}

export default function SurveyManager({ onSurveyUpdated }: SurveyManagerProps) {
  // State for surveys and questions
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for active survey
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  
  // State for forms
  const [surveyForm, setSurveyForm] = useState({ name: '', description: '' });
  const [questionForm, setQuestionForm] = useState({ question_text: '', is_follow_up: false, parent_question_id: '' });
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);
  
  // State for UI
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [draggedQuestion, setDraggedQuestion] = useState<Question | null>(null);
  
  // Add state for drag-and-drop visual cues
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  
  // Add state for deletion confirmation
  const [deletingSurveyId, setDeletingSurveyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Add state for voice-friendly validation
  const [questionValidation, setQuestionValidation] = useState<string | null>(null);
  const [questionSuggestions, setQuestionSuggestions] = useState<string[]>([]);
  const [previewVoiceQuestion, setPreviewVoiceQuestion] = useState<string>('');
  
  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);
  
  // Fetch all data
  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch surveys
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (surveyError) throw surveyError;
      
      // If no surveys, create the Primary Care Access Survey
      if (!surveyData || surveyData.length === 0) {
        console.log('No surveys found, creating sample survey');
        const sampleSurveyId = await createSampleSurvey();
        
        if (sampleSurveyId) {
          const { data: newSurveyData } = await supabase
            .from('surveys')
            .select('*')
            .order('created_at', { ascending: false });
            
          setSurveys(newSurveyData || []);
          setActiveSurveyId(sampleSurveyId);
        } else {
          setSurveys([]);
        }
      } else {
        setSurveys(surveyData);
        
        // Set active survey if none is set but we have surveys
        if (!activeSurveyId && surveyData.length > 0) {
          setActiveSurveyId(surveyData[0].id);
        }
      }
      
      // Fetch all questions
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (questionError) throw questionError;
      setQuestions(questionData || []);
      
      // Fetch survey questions if we have an active survey
      if (activeSurveyId) {
        await fetchSurveyQuestions(activeSurveyId);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  // Handle updating active survey
  useEffect(() => {
    if (activeSurveyId) {
      fetchSurveyQuestions(activeSurveyId);
    } else {
      // Clear survey questions if no survey is selected
      setSurveyQuestions([]);
    }
  }, [activeSurveyId]);
  
  // Fetch survey questions
  async function fetchSurveyQuestions(surveyId: string) {
    if (!surveyId) return;
    
    setLoading(true);
    try {
      const { data: surveyQuestionsData, error: surveyQuestionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('"order"', { ascending: true });
      
      if (surveyQuestionsError) throw surveyQuestionsError;
      setSurveyQuestions(surveyQuestionsData || []);
    } catch (error) {
      console.error('Error fetching survey questions:', error);
      setError('Failed to load survey questions');
    } finally {
      setLoading(false);
    }
  }
  
  // Handle survey form submission
  async function handleSurveySubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!surveyForm.name) {
      setError('Survey name is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      if (formMode === 'create') {
        // Create new survey
        const { data, error } = await supabase
          .from('surveys')
          .insert({
            name: surveyForm.name,
            description: surveyForm.description
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setSurveys([data, ...surveys]);
        setActiveSurveyId(data.id);
        setSuccessMessage('Survey created successfully');
      } else {
        // Update existing survey
        if (!editId) {
          setError('No survey selected for editing');
          return;
        }
        
        const { data, error } = await supabase
          .from('surveys')
          .update({
            name: surveyForm.name,
            description: surveyForm.description
          })
          .eq('id', editId)
          .select()
          .single();
        
        if (error) throw error;
        
        setSurveys(surveys.map(s => s.id === editId ? data : s));
        setSuccessMessage('Survey updated successfully');
      }
      
      // Reset form
      setSurveyForm({ name: '', description: '' });
      setFormMode('create');
      setEditId(null);
      setShowSurveyForm(false);
      
      // Notify parent
      if (onSurveyUpdated) onSurveyUpdated();
      
    } catch (error) {
      console.error('Error handling survey:', error);
      setError('Failed to save survey. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  // Handle question form submission
  async function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!questionForm.question_text) {
      setError('Question text is required');
      return;
    }
    
    // Validate question for voice friendliness
    const validation = validateVoiceQuestion(
      questionForm.question_text, 
      formMode === 'edit' && editId 
        ? getQuestionById(editId)?.metadata 
        : undefined
    );
    
    if (validation) {
      setQuestionValidation(validation);
      return;
    }
    
    // Format question text to be voice-friendly
    const voiceFriendlyText = formatVoiceQuestion(
      questionForm.question_text,
      formMode === 'edit' && editId 
        ? getQuestionById(editId)?.metadata 
        : undefined
    );
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      if (formMode === 'create') {
        // Create new question
        const { data, error } = await supabase
          .from('questions')
          .insert({
            question_text: voiceFriendlyText, // Use voice-friendly text
            is_follow_up: questionForm.is_follow_up,
            parent_question_id: questionForm.parent_question_id || null
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setQuestions([data, ...questions]);
        setSuccessMessage('Question created successfully');
      } else {
        // Update existing question
        if (!editId) {
          setError('No question selected for editing');
          return;
        }
        
        const { data, error } = await supabase
          .from('questions')
          .update({
            question_text: voiceFriendlyText, // Use voice-friendly text
            is_follow_up: questionForm.is_follow_up,
            parent_question_id: questionForm.parent_question_id || null
          })
          .eq('id', editId)
          .select()
          .single();
        
        if (error) throw error;
        
        setQuestions(questions.map(q => q.id === editId ? data : q));
        setSuccessMessage('Question updated successfully');
      }
      
      // Reset form
      setQuestionForm({ question_text: '', is_follow_up: false, parent_question_id: '' });
      setFormMode('create');
      setEditId(null);
      setShowQuestionForm(false);
      setQuestionValidation(null);
      setQuestionSuggestions([]);
      setPreviewVoiceQuestion('');
      
      // Notify parent
      if (onSurveyUpdated) onSurveyUpdated();
      
    } catch (error) {
      console.error('Error handling question:', error);
      setError('Failed to save question. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  // Function to check question validation and update preview as user types
  function handleQuestionTextChange(text: string) {
    setQuestionForm({ ...questionForm, question_text: text });
    
    // Get metadata for validation
    const metadata = formMode === 'edit' && editId 
      ? getQuestionById(editId)?.metadata 
      : undefined;
    
    // Update validation status
    setQuestionValidation(validateVoiceQuestion(text, metadata));
    
    // Update suggestions
    setQuestionSuggestions(suggestVoiceImprovements(text, metadata));
    
    // Update preview
    setPreviewVoiceQuestion(formatVoiceQuestion(text, metadata));
  }
  
  // Handle adding question to survey
  async function handleAddQuestionToSurvey(questionId: string) {
    if (!activeSurveyId) {
      setError('No active survey selected');
      return;
    }
    
    setLoading(true);
    try {
      // Check if question already exists in survey
      const exists = surveyQuestions.some(sq => sq.question_id === questionId && sq.survey_id === activeSurveyId);
      
      if (exists) {
        setError('This question is already in the survey');
        setLoading(false);
        return;
      }
      
      // Get next order number
      const nextOrder = surveyQuestions.length > 0 
        ? Math.max(...surveyQuestions.map(sq => sq["order"])) + 1 
        : 1;
      
      // Add question to survey
      const { data, error } = await supabase
        .from('survey_questions')
        .insert({
          survey_id: activeSurveyId,
          question_id: questionId,
          "order": nextOrder
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setSurveyQuestions([...surveyQuestions, data]);
      setSuccessMessage('Question added to survey successfully');
      
      // Notify parent
      if (onSurveyUpdated) onSurveyUpdated();
      
    } catch (error) {
      console.error('Error adding question to survey:', error);
      setError('Failed to add question to survey');
    } finally {
      setLoading(false);
    }
  }
  
  // Handle removing question from survey
  async function handleRemoveQuestionFromSurvey(surveyQuestionId: string) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('survey_questions')
        .delete()
        .eq('id', surveyQuestionId);
      
      if (error) throw error;
      
      // Remove from state
      setSurveyQuestions(surveyQuestions.filter(sq => sq.id !== surveyQuestionId));
      
      // Reorder remaining questions
      const remaining = surveyQuestions.filter(sq => sq.id !== surveyQuestionId)
        .sort((a, b) => a["order"] - b["order"]);
      
      const updates = remaining.map((sq, index) => ({
        id: sq.id,
        "order": index + 1
      }));
      
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('survey_questions')
          .upsert(updates);
        
        if (updateError) throw updateError;
      }
      
      setSuccessMessage('Question removed from survey successfully');
      
      // Notify parent
      if (onSurveyUpdated) onSurveyUpdated();
      
    } catch (error) {
      console.error('Error removing question from survey:', error);
      setError('Failed to remove question from survey');
    } finally {
      setLoading(false);
    }
  }
  
  // Handle reordering questions
  async function handleReorderQuestions(sourceIndex: number, destinationIndex: number) {
    if (sourceIndex === destinationIndex) return;
    
    const newSurveyQuestions = [...surveyQuestions];
    const [movedItem] = newSurveyQuestions.splice(sourceIndex, 1);
    newSurveyQuestions.splice(destinationIndex, 0, movedItem);
    
    // Update order property
    const updatedQuestions = newSurveyQuestions.map((sq, index) => ({
      ...sq,
      "order": index + 1
    }));
    
    setSurveyQuestions(updatedQuestions);
    
    // Update in database
    try {
      const updates = updatedQuestions.map(sq => ({
        id: sq.id,
        "order": sq["order"]
      }));
      
      const { error } = await supabase
        .from('survey_questions')
        .upsert(updates);
      
      if (error) throw error;
      
    } catch (error) {
      console.error('Error reordering questions:', error);
      setError('Failed to reorder questions');
      // Revert to original order on error
      fetchData();
    }
  }
  
  // Function to handle drag start
  const handleDragStart = (e: React.DragEvent, question: Question) => {
    e.dataTransfer.setData('questionId', question.id);
    setDraggedQuestion(question);
    setDraggedQuestionId(question.id);
    
    // Add a ghost image for better drag visual
    const dragImage = document.createElement('div');
    dragImage.textContent = question.question_text.substring(0, 30) + '...';
    dragImage.className = 'bg-blue-100 p-2 rounded shadow-md text-sm';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };
  
  // Function to handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  
  // Function to handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };
  
  // Function to handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const questionId = e.dataTransfer.getData('questionId');
    
    if (draggedQuestion) {
      handleAddQuestionToSurvey(questionId);
      setDraggedQuestion(null);
      setDraggedQuestionId(null);
    }
  };
  
  // Get a question by ID
  const getQuestionById = (id: string): Question | undefined => {
    return questions.find(q => q.id === id);
  };
  
  // Get survey questions with their question text
  const getSurveyQuestionsWithText = () => {
    if (!surveyQuestions.length) return [];
    
    return surveyQuestions
      .sort((a, b) => a["order"] - b["order"])
      .map(sq => {
        const question = getQuestionById(sq.question_id);
        return {
          ...sq,
          questionText: question?.question_text || 'Question not found'
        };
      });
  };
  
  // Get active survey
  const getActiveSurvey = (): Survey | undefined => {
    if (!activeSurveyId) return undefined;
    return surveys.find(s => s.id === activeSurveyId);
  };
  
  // Handle survey deletion
  async function handleDeleteSurvey(surveyId: string) {
    if (!surveyId) return;
    
    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // Get the survey name for confirmation message
      const surveyToDelete = surveys.find(s => s.id === surveyId);
      const surveyName = surveyToDelete?.name || 'Unknown survey';
      
      // Get all survey questions for this survey first
      const { data: surveyQuestionsData, error: fetchSQError } = await supabase
        .from('survey_questions')
        .select('question_id')
        .eq('survey_id', surveyId);
      
      if (fetchSQError) throw fetchSQError;
      
      const questionIds = surveyQuestionsData ? surveyQuestionsData.map(sq => sq.question_id) : [];
      
      console.log('Deleting survey:', surveyId, surveyName);
      console.log('Associated question IDs:', questionIds);
      
      // 1. Delete all survey questions
      const { error: deleteQuestionsError } = await supabase
        .from('survey_questions')
        .delete()
        .eq('survey_id', surveyId);
      
      if (deleteQuestionsError) {
        console.error('Error deleting survey questions:', deleteQuestionsError);
        throw deleteQuestionsError;
      }
      
      console.log('Deleted survey questions successfully');
      
      // 2. If there are associated questions, delete responses for them
      if (questionIds.length > 0) {
        const { error: deleteResponsesError } = await supabase
          .from('responses')
          .delete()
          .in('question_id', questionIds);
        
        if (deleteResponsesError) {
          console.error('Error deleting responses:', deleteResponsesError);
          throw deleteResponsesError;
        }
        
        console.log('Deleted responses successfully');
      }
      
      // 3. Delete the survey itself
      const { error: deleteSurveyError } = await supabase
        .from('surveys')
        .delete()
        .eq('id', surveyId);
      
      if (deleteSurveyError) {
        console.error('Error deleting survey:', deleteSurveyError);
        throw deleteSurveyError;
      }
      
      console.log('Deleted survey successfully');
      
      // Update state
      setSurveys(surveys.filter(s => s.id !== surveyId));
      setSurveyQuestions([]);
      setSuccessMessage(`Successfully deleted "${surveyName}" and all related data`);
      
      // If this was the active survey, select the next available one or null
      if (activeSurveyId === surveyId) {
        const remainingSurveys = surveys.filter(s => s.id !== surveyId);
        setActiveSurveyId(remainingSurveys.length > 0 ? remainingSurveys[0].id : null);
      }
      
      // Reset deletion state
      setDeletingSurveyId(null);
      
      // Notify parent
      if (onSurveyUpdated) onSurveyUpdated();
      
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting survey:', error);
      setError(`Failed to delete survey: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  }
  
  // Cancel survey deletion
  function cancelDeleteSurvey() {
    setDeletingSurveyId(null);
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Survey Manager</h2>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md">
          {successMessage}
          <button 
            onClick={() => setSuccessMessage(null)}
            className="ml-2 text-green-500 hover:text-green-700"
          >
            ✕
          </button>
        </div>
      )}
      
      {loading && !surveys.length && !questions.length ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column - Survey List */}
          <div className="md:w-1/3 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Surveys</h3>
              <button
                onClick={() => {
                  setSurveyForm({ name: '', description: '' });
                  setFormMode('create');
                  setEditId(null);
                  setShowSurveyForm(true);
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
              >
                Create Survey
              </button>
            </div>
            
            {/* Survey Form */}
            {showSurveyForm && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <h4 className="font-medium mb-3">{formMode === 'create' ? 'Create New Survey' : 'Edit Survey'}</h4>
                <form onSubmit={handleSurveySubmit} className="space-y-3">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1">Survey Name</label>
                    <input
                      id="name"
                      type="text"
                      value={surveyForm.name}
                      onChange={e => setSurveyForm({ ...surveyForm, name: e.target.value })}
                      className="w-full p-2 border rounded"
                      placeholder="Primary Care Access Survey"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      id="description"
                      value={surveyForm.description}
                      onChange={e => setSurveyForm({ ...surveyForm, description: e.target.value })}
                      className="w-full p-2 border rounded"
                      placeholder="Survey about primary care access and barriers"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:bg-blue-300"
                      disabled={loading}
                    >
                      {formMode === 'create' ? 'Create' : 'Update'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSurveyForm(false)}
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {/* Survey List */}
            <div className="border rounded-md overflow-hidden">
              {surveys.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No surveys found. Create your first survey to get started.
                </div>
              ) : (
                <ul className="divide-y">
                  {surveys.map(survey => (
                    <li 
                      key={survey.id}
                      className={`p-3 hover:bg-gray-50 flex justify-between items-center cursor-pointer ${
                        activeSurveyId === survey.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setActiveSurveyId(survey.id)}
                    >
                      <div>
                        <p className="font-medium">{survey.name}</p>
                        {survey.description && (
                          <p className="text-sm text-gray-500">{survey.description}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSurveyForm({ 
                              name: survey.name, 
                              description: survey.description 
                            });
                            setFormMode('edit');
                            setEditId(survey.id);
                            setShowSurveyForm(true);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          Edit
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingSurveyId(survey.id);
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Right Column - Active Survey Questions and All Questions */}
          <div className="md:w-2/3 space-y-4">
            {activeSurveyId && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-700 border-b pb-2">
                  {getActiveSurvey()?.name || 'Selected Survey'}
                </h3>
                
                <div className="flex justify-between">
                  <h4 className="text-lg font-medium">Survey Questions</h4>
                  
                  <div className="space-x-2">
                    <button
                      onClick={() => setShowImporter(!showImporter)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      {showImporter ? "Hide CSV Importer" : "Import CSV"}
                    </button>
                    
                    <button
                      onClick={() => {
                        setQuestionForm({ question_text: '', is_follow_up: false, parent_question_id: '' });
                        setFormMode('create');
                        setEditId(null);
                        setShowQuestionForm(true);
                      }}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      Create Question
                    </button>
                  </div>
                </div>
                
                {/* Question Form */}
                {showQuestionForm && (
                  <div className="bg-gray-50 p-6 rounded-md border border-gray-200 mt-4">
                    <h4 className="font-medium text-xl mb-4">{formMode === 'create' ? 'Create New Question' : 'Edit Question'}</h4>
                    <form onSubmit={handleQuestionSubmit} className="space-y-4">
                      {/* Question ID Field */}
                      <div>
                        <label htmlFor="question_id" className="block text-sm font-medium mb-1">Question Number</label>
                        <div className="p-2 bg-gray-100 rounded text-sm">
                          {formMode === 'edit' && editId ? 
                            `${questions.findIndex(q => q.id === editId) + 1}` : 
                            'New Question'
                          }
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Question number is automatically assigned based on question order</p>
                      </div>
                      
                      {/* Section Field */}
                      <div>
                        <label htmlFor="section" className="block text-sm font-medium mb-1">Section</label>
                        <input
                          id="section"
                          type="text"
                          value={formMode === 'edit' && editId 
                            ? ((getQuestionById(editId)?.metadata as any)?.section || '') 
                            : ''}
                          onChange={e => {
                            if (formMode === 'edit' && editId) {
                              const question = getQuestionById(editId);
                              if (question) {
                                const updatedMetadata = {
                                  ...(question.metadata || {}),
                                  section: e.target.value
                                };
                                
                                // Update the question with new metadata
                                supabase
                                  .from('questions')
                                  .update({ metadata: updatedMetadata })
                                  .eq('id', editId)
                                  .then(() => {
                                    // Update local state
                                    setQuestions(questions.map(q => 
                                      q.id === editId 
                                        ? { ...q, metadata: updatedMetadata } 
                                        : q
                                    ));
                                  });
                              }
                            }
                          }}
                          className="w-full p-2 border rounded"
                          placeholder="Accessing Primary Care"
                        />
                        <p className="text-xs text-gray-500 mt-1">The section this question belongs to</p>
                      </div>
                      
                      {/* Question Text Field */}
                      <div>
                        <label htmlFor="question_text" className="block text-sm font-medium mb-1">Question Text</label>
                        <textarea
                          id="question_text"
                          value={questionForm.question_text}
                          onChange={e => handleQuestionTextChange(e.target.value)}
                          className={`w-full p-2 border rounded ${questionValidation ? 'border-red-300' : ''}`}
                          placeholder="Do you have a primary care doctor you see regularly?"
                          rows={3}
                        />
                        {questionValidation && (
                          <p className="text-xs text-red-500 mt-1">
                            {questionValidation}
                          </p>
                        )}
                        
                        {/* Voice-friendly suggestions */}
                        {questionSuggestions.length > 0 && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                            <p className="font-medium text-blue-700">Suggestions to improve voice interaction:</p>
                            <ul className="list-disc pl-4 mt-1 text-blue-600">
                              {questionSuggestions.map((suggestion, index) => (
                                <li key={index}>{suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Voice preview */}
                        {questionForm.question_text && !questionValidation && (
                          <div className="mt-2 p-2 bg-green-50 rounded">
                            <p className="text-xs font-medium text-green-700">Voice-friendly preview:</p>
                            <p className="text-sm text-green-800 mt-1">{previewVoiceQuestion}</p>
                          </div>
                        )}
                        
                        <p className="text-xs text-gray-500 mt-1">
                          The question will be automatically formatted to be voice-friendly
                        </p>
                      </div>
                      
                      {/* Response Type Field */}
                      <div>
                        <label htmlFor="response_type" className="block text-sm font-medium mb-1">Response Type</label>
                        <select
                          id="response_type"
                          value={formMode === 'edit' && editId 
                            ? ((getQuestionById(editId)?.metadata as any)?.response_type || '') 
                            : ''}
                          onChange={e => {
                            if (formMode === 'edit' && editId) {
                              const question = getQuestionById(editId);
                              if (question) {
                                const updatedMetadata = {
                                  ...(question.metadata || {}),
                                  response_type: e.target.value
                                };
                                
                                // Update the question with new metadata
                                supabase
                                  .from('questions')
                                  .update({ metadata: updatedMetadata })
                                  .eq('id', editId)
                                  .then(() => {
                                    // Update local state
                                    setQuestions(questions.map(q => 
                                      q.id === editId 
                                        ? { ...q, metadata: updatedMetadata } 
                                        : q
                                    ));
                                  });
                              }
                            }
                          }}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">Select response type</option>
                          <option value="Multiple-Choice">Multiple-Choice</option>
                          <option value="Open-Ended">Open-Ended</option>
                          <option value="Numeric">Numeric</option>
                          <option value="Yes-No">Yes-No</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">The type of response expected for this question</p>
                      </div>
                      
                      {/* Options Field - Shown only for Multiple-Choice or Yes-No */}
                      {formMode === 'edit' && editId && 
                        ['Multiple-Choice', 'Yes-No'].includes(((getQuestionById(editId)?.metadata as any)?.response_type || '')) && (
                        <div>
                          <label htmlFor="options" className="block text-sm font-medium mb-1">Response Options</label>
                          <textarea
                            id="options"
                            value={(getQuestionById(editId)?.metadata as any)?.options?.join('\n') || ''}
                            onChange={e => {
                              const question = getQuestionById(editId);
                              if (question) {
                                const options = e.target.value.split('\n').filter(o => o.trim() !== '');
                                const updatedMetadata = {
                                  ...(question.metadata || {}),
                                  options
                                };
                                
                                // Update the question with new metadata
                                supabase
                                  .from('questions')
                                  .update({ metadata: updatedMetadata })
                                  .eq('id', editId)
                                  .then(() => {
                                    // Update local state
                                    setQuestions(questions.map(q => 
                                      q.id === editId 
                                        ? { ...q, metadata: updatedMetadata } 
                                        : q
                                    ));
                                  });
                              }
                            }}
                            className="w-full p-2 border rounded"
                            placeholder="Yes&#10;No&#10;I don't know"
                            rows={4}
                          />
                          <p className="text-xs text-gray-500 mt-1">Enter each option on a new line</p>
                        </div>
                      )}
                      
                      {/* Follow-up Checkbox */}
                      <div className="flex items-center">
                        <input
                          id="is_follow_up"
                          type="checkbox"
                          checked={questionForm.is_follow_up}
                          onChange={e => setQuestionForm({ ...questionForm, is_follow_up: e.target.checked })}
                          className="mr-2"
                        />
                        <label htmlFor="is_follow_up" className="text-sm">This is a follow-up question</label>
                      </div>
                      
                      {/* Parent Question Field - Only shown for follow-up questions */}
                      {questionForm.is_follow_up && (
                        <div>
                          <label htmlFor="parent_question_id" className="block text-sm font-medium mb-1">Parent Question</label>
                          <select
                            id="parent_question_id"
                            value={questionForm.parent_question_id}
                            onChange={e => setQuestionForm({ ...questionForm, parent_question_id: e.target.value })}
                            className="w-full p-2 border rounded"
                          >
                            <option value="">Select parent question</option>
                            {questions.map((q, index) => {
                              // Skip current question and follow-up questions as parent options
                              if ((formMode === 'edit' && q.id === editId) || q.is_follow_up) return null;
                              
                              // Simple index for display (1-based)
                              const displayIndex = index + 1;
                              
                              return (
                                <option key={q.id} value={q.id}>
                                  {displayIndex}. {q.question_text.substring(0, 50)}{q.question_text.length > 50 ? '...' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                      
                      {/* Follow-up Trigger Field - Only shown if not a follow-up */}
                      {!questionForm.is_follow_up && formMode === 'edit' && editId && (
                        <div>
                          <label htmlFor="follow_up_trigger" className="block text-sm font-medium mb-1">Follow-up Trigger</label>
                          <input
                            id="follow_up_trigger"
                            type="text"
                            value={(getQuestionById(editId)?.metadata as any)?.follow_up_trigger || ''}
                            onChange={e => {
                              const question = getQuestionById(editId);
                              if (question) {
                                const updatedMetadata = {
                                  ...(question.metadata || {}),
                                  follow_up_trigger: e.target.value
                                };
                                
                                // Update the question with new metadata
                                supabase
                                  .from('questions')
                                  .update({ metadata: updatedMetadata })
                                  .eq('id', editId)
                                  .then(() => {
                                    // Update local state
                                    setQuestions(questions.map(q => 
                                      q.id === editId 
                                        ? { ...q, metadata: updatedMetadata } 
                                        : q
                                    ));
                                  });
                              }
                            }}
                            className="w-full p-2 border rounded"
                            placeholder="Yes"
                          />
                          <p className="text-xs text-gray-500 mt-1">The response that will trigger follow-up questions (e.g., "Yes")</p>
                        </div>
                      )}
                      
                      {/* Follow-up Text Field - Only shown if not a follow-up */}
                      {!questionForm.is_follow_up && formMode === 'edit' && editId && (
                        <div>
                          <label htmlFor="follow_up_text" className="block text-sm font-medium mb-1">Follow-up Question Text</label>
                          <textarea
                            id="follow_up_text"
                            value={(getQuestionById(editId)?.metadata as any)?.follow_up_text || ''}
                            onChange={e => {
                              const question = getQuestionById(editId);
                              if (question) {
                                const updatedMetadata = {
                                  ...(question.metadata || {}),
                                  follow_up_text: e.target.value
                                };
                                
                                // Update the question with new metadata
                                supabase
                                  .from('questions')
                                  .update({ metadata: updatedMetadata })
                                  .eq('id', editId)
                                  .then(() => {
                                    // Update local state
                                    setQuestions(questions.map(q => 
                                      q.id === editId 
                                        ? { ...q, metadata: updatedMetadata } 
                                        : q
                                    ));
                                  });
                              }
                            }}
                            className="w-full p-2 border rounded"
                            placeholder="Please tell us more about your experience..."
                            rows={3}
                          />
                          <p className="text-xs text-gray-500 mt-1">Text for a follow-up question that will be asked if the trigger condition is met</p>
                        </div>
                      )}
                      
                      <div className="flex space-x-3">
                        <button
                          type="submit"
                          className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:bg-green-300"
                          disabled={loading}
                        >
                          {formMode === 'create' ? 'Create' : 'Update'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuestionForm(false)}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
            
            {!activeSurveyId && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-700">Select or Create a Survey</h3>
                <p className="text-gray-500 mt-2">Choose a survey from the list or create a new one to get started</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Deletion Confirmation Modal */}
      {deletingSurveyId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold text-red-600 mb-4">Confirm Deletion</h3>
            <p className="mb-4">
              Are you sure you want to delete this survey? This will permanently remove:
            </p>
            <ul className="list-disc pl-6 mb-4 text-sm text-gray-600">
              <li>The survey "{surveys.find(s => s.id === deletingSurveyId)?.name}"</li>
              <li>All questions linked to this survey</li>
              <li>All responses collected for this survey</li>
            </ul>
            <p className="mb-6 text-sm text-gray-600">
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeleteSurvey}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSurvey(deletingSurveyId)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Survey'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* CSV Question Importer */}
      {showImporter && (
        <QuestionImporter onQuestionsImported={() => {
          setShowImporter(false);
          fetchData();
        }} />
      )}
      
      {/* Survey Question List */}
      <div 
        className={`border rounded-md overflow-hidden bg-white p-4 min-h-[200px] ${
          isDraggingOver ? 'bg-blue-50 border-blue-300 border-dashed' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-center mb-4">
          <div className="text-blue-500 text-center">
            <p className="text-sm font-semibold">Drag questions here to add them to the survey</p>
            <p className="text-xs text-gray-500 mt-1">
              Questions will automatically be added to this survey in the order they are dropped
            </p>
          </div>
        </div>
        
        {getSurveyQuestionsWithText().length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No questions in this survey yet</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {getSurveyQuestionsWithText().map((sq, index) => {
              // Simple index for display (1-based)
              const displayIndex = index + 1;
              
              return (
                <li key={sq.id} className="flex items-start p-2 bg-gray-50 rounded-md">
                  <span className="mr-2 text-gray-500 font-medium">{displayIndex}.</span>
                  <div className="flex-1">
                    <p>{sq.questionText}</p>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <button
                      onClick={() => handleRemoveQuestionFromSurvey(sq.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove question"
                    >
                      ✕
                    </button>
                    {index > 0 && (
                      <button 
                        onClick={() => handleReorderQuestions(index, index - 1)}
                        className="text-gray-500 hover:text-gray-700"
                        title="Move up"
                      >
                        ↑
                      </button>
                    )}
                    {index < getSurveyQuestionsWithText().length - 1 && (
                      <button 
                        onClick={() => handleReorderQuestions(index, index + 1)}
                        className="text-gray-500 hover:text-gray-700"
                        title="Move down"
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Available Questions List */}
      <div className="mt-8">
        <h4 className="text-lg font-medium mb-2">Available Questions</h4>
        <div className="border rounded-md overflow-hidden max-h-[500px] overflow-y-auto">
          {questions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No questions found. Create your first question or import questions.
            </div>
          ) : (
            <ul className="divide-y">
              {questions.map((question, index) => {
                // Simple index for display (1-based)
                const displayIndex = index + 1;
                
                return (
                  <li 
                    key={question.id}
                    className={`p-3 hover:bg-gray-50 flex justify-between items-start 
                      ${draggedQuestionId === question.id ? 'opacity-50 bg-blue-50' : ''}
                      ${surveyQuestions.some(sq => sq.question_id === question.id) ? 'bg-green-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, question)}
                  >
                    <div className="flex-1">
                      <p>
                        <span className="font-medium text-blue-600 mr-2">{displayIndex}.</span>
                        {question.question_text}
                      </p>
                      {question.is_follow_up && (
                        <p className="text-xs text-blue-500 mt-1">
                          Follow-up question
                          {question.parent_question_id && 
                            ` to: ${getQuestionById(question.parent_question_id)?.question_text.substring(0, 30)}...`
                          }
                        </p>
                      )}
                      {surveyQuestions.some(sq => sq.question_id === question.id) && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Already in this survey
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2 ml-2">
                      <button
                        onClick={() => {
                          setQuestionForm({
                            question_text: question.question_text,
                            is_follow_up: question.is_follow_up,
                            parent_question_id: question.parent_question_id || ''
                          });
                          setFormMode('edit');
                          setEditId(question.id);
                          setShowQuestionForm(true);
                        }}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleAddQuestionToSurvey(question.id)}
                        className={`${surveyQuestions.some(sq => sq.question_id === question.id) 
                          ? 'text-gray-400' 
                          : 'text-green-500 hover:text-green-700'}`}
                        disabled={!activeSurveyId || surveyQuestions.some(sq => sq.question_id === question.id)}
                        title={surveyQuestions.some(sq => sq.question_id === question.id) ? 'Already in survey' : 'Add to survey'}
                      >
                        {surveyQuestions.some(sq => sq.question_id === question.id) ? 'Added' : 'Add'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
} 