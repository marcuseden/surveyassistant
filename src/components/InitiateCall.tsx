'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/supabase/db';
import type { PhoneList, Survey, Question, SurveyQuestion } from '@/lib/supabase/db';

interface InitiateCallProps {
  phoneList: PhoneList[];
  onCallInitiated?: () => void;
}

// Twilio voice options 
const twilioVoiceOptions = [
  { value: 'Polly.Joanna', label: 'Joanna (Female, US)' },
  { value: 'Polly.Matthew', label: 'Matthew (Male, US)' },
  { value: 'Polly.Brian', label: 'Brian (Male, UK)' },
  { value: 'Polly.Amy', label: 'Amy (Female, UK)' },
  { value: 'Polly.Camila', label: 'Camila (Female, Portuguese)' },
  { value: 'Polly.Lupe', label: 'Lupe (Female, US Spanish)' },
  { value: 'Google.en-US-Wavenet-F', label: 'Google WaveNet Female (US)' },
  { value: 'Google.en-US-Wavenet-D', label: 'Google WaveNet Male (US)' },
  { value: 'Google.en-US-Standard-C', label: 'Google Standard Female (US)' },
  { value: 'Google.en-US-Standard-B', label: 'Google Standard Male (US)' },
];

// ElevenLabs voice options
const elevenLabsVoiceOptions = [
  { value: 'RACHEL', label: 'Rachel (Female, Warm & Natural)' },
  { value: 'ADAM', label: 'Adam (Male, Authoritative)' },
  { value: 'ANTONI', label: 'Antoni (Male, Crisp & Clear)' },
  { value: 'JOSH', label: 'Josh (Male, Deep)' },
  { value: 'ELLI', label: 'Elli (Female, Approachable)' },
  { value: 'DOMI', label: 'Domi (Female, Professional)' },
  { value: 'BELLA', label: 'Bella (Female, Natural)' },
  { value: 'CALLUM', label: 'Callum (Male, British)' },
];

// Language options
const languageOptions = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
];

// Test number info
const TWILIO_TEST_PHONE_ID = '06636af9-18e6-4754-a6ce-76612c9611ce';

export default function InitiateCall({ phoneList, onCallInitiated }: InitiateCallProps) {
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<string>('Polly.Joanna');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [use11Labs, setUse11Labs] = useState<boolean>(true);
  
  // State for surveys and questions
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [surveysLoading, setSurveysLoading] = useState<boolean>(true);
  
  // Fetch surveys on component mount
  useEffect(() => {
    fetchSurveys();

    // Default to Twilio test number for easier testing
    if (phoneList.some(p => p.id === TWILIO_TEST_PHONE_ID)) {
      setSelectedPhone(TWILIO_TEST_PHONE_ID);
      setInfoMessage("Using Twilio test number for demo purposes. This simulates a call without actually making one.");
    }
  }, [phoneList]);
  
  // Effect to update voice selection when toggling between 11Labs and Twilio
  useEffect(() => {
    if (use11Labs) {
      // Default to Rachel for 11Labs
      setSelectedVoice('RACHEL');
    } else {
      // Default to Polly.Joanna for Twilio
      setSelectedVoice('Polly.Joanna');
    }
  }, [use11Labs]);
  
  // Fetch surveys
  async function fetchSurveys() {
    setSurveysLoading(true);
    try {
      // Fetch surveys
      const { data: surveyData, error: surveyError } = await db
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (surveyError) throw surveyError;
      setSurveys(surveyData || []);
      
      // Set default selected survey if available
      if (surveyData && surveyData.length > 0 && !selectedSurvey) {
        setSelectedSurvey(surveyData[0].id);
        await fetchSurveyQuestions(surveyData[0].id);
      }
      
      // Fetch all questions
      const { data: questionData, error: questionError } = await db
        .from('questions')
        .select('*');
      
      if (questionError) throw questionError;
      setQuestions(questionData || []);
      
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setSurveysLoading(false);
    }
  }
  
  // Fetch survey questions when survey changes
  async function fetchSurveyQuestions(surveyId: string) {
    try {
      const { data: surveyQuestionsData, error: surveyQuestionsError } = await db
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('"order"', { ascending: true });
      
      if (surveyQuestionsError) throw surveyQuestionsError;
      setSurveyQuestions(surveyQuestionsData || []);
    } catch (error) {
      console.error('Error fetching survey questions:', error);
    }
  }
  
  // Handle survey change
  const handleSurveyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const surveyId = e.target.value;
    setSelectedSurvey(surveyId);
    
    if (surveyId) {
      await fetchSurveyQuestions(surveyId);
    } else {
      setSurveyQuestions([]);
    }
  };

  // Handle phone number change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const phoneId = e.target.value;
    setSelectedPhone(phoneId);
    
    // Clear any previous messages
    setInfoMessage(null);
    
    // Check if this is a test number
    const selectedPhoneObj = phoneList.find(p => p.id === phoneId);
    if (selectedPhoneObj && selectedPhoneObj.phone_number.startsWith('+1500555')) {
      setInfoMessage("Using Twilio test number for demo purposes. This simulates a call without actually making one.");
    }
    // Check if this is an international number (not US/Canada)
    else if (selectedPhoneObj && !selectedPhoneObj.phone_number.startsWith('+1')) {
      setInfoMessage("Note: International numbers require special permissions from Twilio. If you see errors, follow the guide in docs/enabling-twilio-sweden-calls.md");
    }
  };
  
  // Get survey questions with their question text
  const getSurveyQuestionsWithText = () => {
    if (!surveyQuestions?.length) return [];
    
    return surveyQuestions
      .sort((a, b) => (a["order"] || 0) - (b["order"] || 0))
      .map(sq => {
        const question = questions.find(q => q.id === sq.question_id);
        return {
          id: sq?.id || '',
          question_id: sq?.question_id || '',
          question_text: question?.question_text || 'Question not found',
          order: sq["order"] || 0
        };
      });
  };
  
  // Get active survey name
  const getActiveSurveyName = (): string => {
    if (!selectedSurvey) return 'No survey selected';
    const survey = surveys.find(s => s.id === selectedSurvey);
    return survey?.name || 'Unknown survey';
  };

  async function handleInitiateCall(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedPhone) {
      setError('Please select a phone number');
      return;
    }
    
    if (!selectedSurvey) {
      setError('Please select a survey');
      return;
    }
    
    if (surveyQuestions.length === 0) {
      setError('Selected survey has no questions');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Make API call to initiate call for the survey
      const response = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneListId: selectedPhone,
          surveyId: selectedSurvey,
          askAllQuestions: true,
          voiceOption: selectedVoice,
          languageOption: selectedLanguage,
          use11Labs: use11Labs
        }),
      });

      // Check for non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate call');
      }

      setSuccess(`Call initiated successfully! ${use11Labs ? '(Using ElevenLabs Voice)' : '(Using Twilio TTS)'}`);
      
      // If this was a test number, add extra info
      if (data.isTestNumber) {
        setSuccess((prev) => `${prev} (Test mode - no actual call was made)`);
      }
      
      // Notify parent component
      if (onCallInitiated) {
        onCallInitiated();
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      
      if (error instanceof Error && error.message.includes('international')) {
        // Add more helpful message for international permissions issues
        setError(`${error.message}. Please enable international permissions in your Twilio account console. See docs/enabling-twilio-sweden-calls.md for instructions.`);
      } else {
        setError(error instanceof Error ? error.message : 'An error occurred while initiating the call');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePopulateSampleQuestions() {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Call the API to populate sample questions
      const response = await fetch('/api/questions', {
        method: 'PUT',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to populate sample questions');
      }

      setSuccess(`Sample questions populated successfully`);
      
      // Refresh surveys and questions
      fetchSurveys();
    } catch (error) {
      console.error('Error populating sample questions:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while populating sample questions');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Initiate Survey Call</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
          {success}
        </div>
      )}
      
      {infoMessage && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-md text-sm">
          {infoMessage}
        </div>
      )}
      
      <form onSubmit={handleInitiateCall} className="space-y-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Select Phone Number
          </label>
          <select
            id="phone"
            value={selectedPhone}
            onChange={handlePhoneChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">-- Select Phone Number --</option>
            {phoneList.map((phone) => (
              <option key={phone.id} value={phone.id}>
                {phone.name}: {phone.phone_number} 
                {phone.phone_number.startsWith('+1500555') ? ' (Test Number)' : ''}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="survey" className="block text-sm font-medium text-gray-700 mb-1">
            Select Survey
          </label>
          <select
            id="survey"
            value={selectedSurvey}
            onChange={handleSurveyChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">-- Select Survey --</option>
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.name}
              </option>
            ))}
          </select>
          
          {/* Show questions count if a survey is selected */}
          {selectedSurvey && (
            <p className="mt-1 text-sm text-gray-500">
              {surveyQuestions.length} questions in this survey
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-2 py-2">
          <span className="text-sm font-medium text-gray-700">Voice Type:</span>
          <div className="flex border rounded-lg overflow-hidden">
            <button 
              type="button"
              className={`px-3 py-1 text-sm ${use11Labs ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setUse11Labs(true)}
            >
              ElevenLabs
            </button>
            <button 
              type="button"
              className={`px-3 py-1 text-sm ${!use11Labs ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setUse11Labs(false)}
            >
              Twilio TTS
            </button>
          </div>
          <div className="ml-2">
            <span className="text-xs text-blue-600 inline-flex items-center">
              {use11Labs ? '✨ More natural AI voice' : '📞 Standard phone voice'}
            </span>
          </div>
        </div>
        
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
          </button>
        </div>
        
        {showAdvanced && (
          <div className="space-y-4 p-3 bg-gray-50 rounded-md">
            <div>
              <label htmlFor="voice" className="block text-sm font-medium text-gray-700 mb-1">
                Voice
              </label>
              <select
                id="voice"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {use11Labs ? (
                  // Show ElevenLabs voices
                  elevenLabsVoiceOptions.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))
                ) : (
                  // Show Twilio voices
                  twilioVoiceOptions.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))
                )}
              </select>
              {use11Labs && (
                <p className="mt-1 text-xs text-gray-500">
                  Using ElevenLabs for natural AI voice synthesis. Requires a valid ElevenLabs API key in .env.local
                </p>
              )}
            </div>
            
            {!use11Labs && (
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  id="language"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {languageOptions.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        
        <div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={loading || !selectedPhone || !selectedSurvey}
          >
            {loading ? 'Initiating Call...' : 'Initiate Call'}
          </button>
        </div>
      </form>
      
      {/* Debug section in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Developer Tools</h3>
          <button
            onClick={handlePopulateSampleQuestions}
            className="py-1 px-3 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
            disabled={loading}
          >
            Populate Sample Questions
          </button>
        </div>
      )}
    </div>
  );
}