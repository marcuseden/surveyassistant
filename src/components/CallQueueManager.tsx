'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/supabase/db';
import type { PhoneList, Survey, CallQueue } from '@/lib/supabase/db';

interface CallQueueManagerProps {
  phoneList: PhoneList[];
  onCallInitiated?: () => void;
}

// Status badge colors
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  abandoned: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-purple-100 text-purple-700'
};

export default function CallQueueManager({ phoneList, onCallInitiated }: CallQueueManagerProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [filter, setFilter] = useState<string>('all');
  
  // For new queue items
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  
  // Advanced filtering
  const [phoneFilter, setPhoneFilter] = useState<string>('');
  const [surveyFilter, setSurveyFilter] = useState<string>('');
  const [progressFilter, setProgressFilter] = useState<string>('all'); // all, complete, incomplete
  const [attemptFilter, setAttemptFilter] = useState<string>('all'); // all, multi, single
  
  // Fetch surveys and queue items on component mount
  useEffect(() => {
    fetchSurveys();
    fetchQueueItems();
  }, []);
  
  // Fetch surveys
  async function fetchSurveys() {
    try {
      const { data, error } = await db
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSurveys(data || []);
      
      // Set default selected survey if available
      if (data && data.length > 0 && !selectedSurvey) {
        setSelectedSurvey(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
    }
  }
  
  // Fetch queue items
  async function fetchQueueItems() {
    setLoading(true);
    setError(null);
    
    try {
      let url = '/api/call-queue';
      const params = new URLSearchParams();
      
      // Apply status filter
      if (filter !== 'all') {
        params.append('status', filter);
      }
      
      // Apply survey filter 
      if (surveyFilter) {
        params.append('surveyId', surveyFilter);
      }
      
      // Apply phone filter
      if (phoneFilter) {
        params.append('phoneListId', phoneFilter);
      }
      
      // Add parameters to URL if we have any
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch call queue');
      }
      
      let data = await response.json();
      
      // Apply client-side filtering for progress and attempts
      if (progressFilter !== 'all') {
        data = data.filter((item: any) => {
          const questionsAnswered = typeof item.questions_answered !== 'undefined' ? 
            item.questions_answered : 
            Object.keys(item.responses || {}).length;
          
          const totalQuestions = item.total_questions || 0;
          
          if (progressFilter === 'complete' && questionsAnswered >= totalQuestions && totalQuestions > 0) {
            return true;
          }
          
          if (progressFilter === 'incomplete' && (questionsAnswered < totalQuestions || totalQuestions === 0)) {
            return true;
          }
          
          return false;
        });
      }
      
      if (attemptFilter !== 'all') {
        data = data.filter((item: any) => {
          if (attemptFilter === 'multi' && item.attempt_count > 1) {
            return true;
          }
          
          if (attemptFilter === 'single' && item.attempt_count <= 1) {
            return true;
          }
          
          return false;
        });
      }
      
      setQueueItems(data);
    } catch (error) {
      console.error('Error fetching call queue:', error);
      setError('Failed to fetch call queue');
    } finally {
      setLoading(false);
    }
  }
  
  // Add item to queue
  async function handleAddToQueue(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedPhone) {
      setError('Please select a phone number');
      return;
    }
    
    if (!selectedSurvey) {
      setError('Please select a survey');
      return;
    }
    
    if (isScheduled && !scheduledTime) {
      setError('Please select a scheduled time');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/call-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneListId: selectedPhone,
          surveyId: selectedSurvey,
          scheduled: isScheduled,
          scheduledTime: isScheduled ? new Date(scheduledTime).toISOString() : null,
          voiceOption: 'Polly.Joanna', // Default voice
          languageOption: 'en-US' // Default language
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add call to queue');
      }
      
      setSuccess('Call added to queue successfully');
      
      // Reset form
      setSelectedPhone('');
      setSelectedSurvey('');
      setIsScheduled(false);
      setScheduledTime('');
      
      // Refresh queue items
      fetchQueueItems();
      
      // Notify parent component
      if (onCallInitiated) {
        onCallInitiated();
      }
    } catch (error) {
      console.error('Error adding call to queue:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while adding call to queue');
    } finally {
      setLoading(false);
    }
  }
  
  // Initiate a call from the queue
  async function handleInitiateCall(queueItemId: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callQueueId: queueItemId
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate call');
      }
      
      setSuccess(`Call initiated successfully with SID: ${data.callSid}`);
      
      // Refresh queue items
      fetchQueueItems();
      
      // Notify parent component
      if (onCallInitiated) {
        onCallInitiated();
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while initiating the call');
    } finally {
      setLoading(false);
    }
  }
  
  // Retry a call from the queue
  async function handleRetryCall(queueItemId: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/twilio/retry-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callQueueId: queueItemId
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry call');
      }
      
      setSuccess(`Call retry initiated successfully with SID: ${data.callSid}`);
      
      // Refresh queue items
      fetchQueueItems();
      
      // Notify parent component
      if (onCallInitiated) {
        onCallInitiated();
      }
    } catch (error) {
      console.error('Error retrying call:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while retrying the call');
    } finally {
      setLoading(false);
    }
  }
  
  // Format date for display
  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }
  
  // Get a description for each status
  function getStatusDescription(status: string): string {
    switch (status) {
      case 'pending':
        return 'Call is queued but has not been initiated yet';
      case 'in-progress':
        return 'Call is currently underway but not yet completed';
      case 'completed':
        return 'Call has successfully completed with all questions answered';
      case 'failed':
        return 'Call was attempted but encountered an error';
      case 'abandoned':
        return 'Call was dropped or abandoned before completion';
      case 'scheduled':
        return 'Call is scheduled for a future time';
      default:
        return 'Unknown status';
    }
  }
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Call Queue Manager</h2>
      
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
      
      {/* Add to Queue Form */}
      <form onSubmit={handleAddToQueue} className="mb-8 space-y-4 border-b pb-6">
        <h3 className="text-lg font-medium">Add New Call to Queue</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Select Phone Number
            </label>
            <select
              id="phone"
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
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
              onChange={(e) => setSelectedSurvey(e.target.value)}
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
          </div>
        </div>
        
        <div className="flex items-center">
          <input
            id="scheduled"
            type="checkbox"
            checked={isScheduled}
            onChange={(e) => setIsScheduled(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="scheduled" className="ml-2 block text-sm text-gray-700">
            Schedule for later
          </label>
        </div>
        
        {isScheduled && (
          <div>
            <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-700 mb-1">
              Schedule Time
            </label>
            <input
              id="scheduledTime"
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={isScheduled}
            />
          </div>
        )}
        
        <div>
          <button
            type="submit"
            className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={loading || !selectedPhone || !selectedSurvey || (isScheduled && !scheduledTime)}
          >
            {loading ? 'Adding to Queue...' : 'Add to Queue'}
          </button>
        </div>
      </form>
      
      {/* Queue Listing */}
      <div className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-3">Call Queue</h3>
          
          {/* Advanced Filters */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filters</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Status Filter */}
              <div>
                <label htmlFor="filter" className="block text-xs font-medium text-gray-500 mb-1">
                  Status:
                </label>
                <select
                  id="filter"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setTimeout(() => fetchQueueItems(), 0);
                  }}
                  className="w-full p-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="abandoned">Abandoned</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              
              {/* Survey Filter */}
              <div>
                <label htmlFor="surveyFilter" className="block text-xs font-medium text-gray-500 mb-1">
                  Survey:
                </label>
                <select
                  id="surveyFilter"
                  value={surveyFilter}
                  onChange={(e) => {
                    setSurveyFilter(e.target.value);
                    setTimeout(() => fetchQueueItems(), 0);
                  }}
                  className="w-full p-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Surveys</option>
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Phone Filter */}
              <div>
                <label htmlFor="phoneFilter" className="block text-xs font-medium text-gray-500 mb-1">
                  Patient:
                </label>
                <select
                  id="phoneFilter"
                  value={phoneFilter}
                  onChange={(e) => {
                    setPhoneFilter(e.target.value);
                    setTimeout(() => fetchQueueItems(), 0);
                  }}
                  className="w-full p-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Patients</option>
                  {phoneList.map((phone) => (
                    <option key={phone.id} value={phone.id}>
                      {phone.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* More Filters */}
              <div className="flex space-x-2">
                {/* Progress Filter */}
                <div className="flex-1">
                  <label htmlFor="progressFilter" className="block text-xs font-medium text-gray-500 mb-1">
                    Progress:
                  </label>
                  <select
                    id="progressFilter"
                    value={progressFilter}
                    onChange={(e) => {
                      setProgressFilter(e.target.value);
                      setTimeout(() => fetchQueueItems(), 0);
                    }}
                    className="w-full p-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="complete">Complete</option>
                    <option value="incomplete">Incomplete</option>
                  </select>
                </div>
                
                {/* Attempts Filter */}
                <div className="flex-1">
                  <label htmlFor="attemptFilter" className="block text-xs font-medium text-gray-500 mb-1">
                    Attempts:
                  </label>
                  <select
                    id="attemptFilter"
                    value={attemptFilter}
                    onChange={(e) => {
                      setAttemptFilter(e.target.value);
                      setTimeout(() => fetchQueueItems(), 0);
                    }}
                    className="w-full p-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="multi">Multiple</option>
                    <option value="single">Single</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Filter Actions */}
            <div className="mt-3 flex justify-end space-x-2">
              <button
                onClick={() => {
                  // Reset all filters
                  setFilter('all');
                  setSurveyFilter('');
                  setPhoneFilter('');
                  setProgressFilter('all');
                  setAttemptFilter('all');
                  setTimeout(() => fetchQueueItems(), 0);
                }}
                className="p-1.5 px-3 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Clear Filters
              </button>
              
              <button
                onClick={() => fetchQueueItems()}
                className="p-1.5 px-3 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-gray-600">
            Showing {queueItems.length} entries
          </p>
          
          <button
            onClick={() => fetchQueueItems()}
            className="p-1 px-3 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
          >
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </span>
          </button>
        </div>
        
        {loading && <p className="text-gray-500 text-center py-4">Loading...</p>}
        
        {!loading && queueItems.length === 0 && (
          <p className="text-gray-500 text-center py-4">No calls in queue</p>
        )}
        
        {!loading && queueItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Survey</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Attempt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {queueItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className={`px-2 py-1 text-xs rounded-full ${statusColors[item.status] || 'bg-gray-100'}`}
                        title={getStatusDescription(item.status)}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.phone_list?.name}: {item.phone_list?.phone_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.surveys?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {typeof item.questions_answered !== 'undefined' && item.questions_answered !== null ? 
                        `${item.questions_answered}/${item.total_questions || '?'}` : 
                        (item.response_count !== undefined ? 
                          `${item.response_count}/${item.total_questions || '?'}` : 
                          (Object.keys(item.responses || {}).length > 0 ? 
                            `${Object.keys(item.responses || {}).length}/${item.total_questions || '?'}` : '-'))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.attempt_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatDate(item.last_attempt_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(item.status === 'pending' || item.status === 'failed' || item.status === 'scheduled') && (
                        <button
                          onClick={() => handleInitiateCall(item.id)}
                          className="text-xs py-1 px-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2 flex items-center"
                          disabled={loading}
                          title="Start a new call for this survey"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          Call Now
                        </button>
                      )}
                      {item.status !== 'completed' && (
                        <button
                          onClick={() => handleRetryCall(item.id)}
                          className="text-xs py-1 px-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                          disabled={loading}
                          title="Retry this call or resume an in-progress call"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Retry Call
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 