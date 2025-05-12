'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase/db';
import type { PhoneList, Question, User } from '@/lib/supabase/db';
import { getUser, signOut } from '@/lib/auth';
import CallHistory from '@/components/CallHistory';
import InitiateCall from '@/components/InitiateCall';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import PhoneManager from '@/components/PhoneManager';
import SurveyManager from '@/components/SurveyManager';
import DirectLogin from '@/components/DirectLogin';
import VoiceSurvey from '@/components/VoiceSurvey';
import CallQueueManager from '@/components/CallQueueManager';

export default function Dashboard() {
  const [phoneList, setPhoneList] = useState<PhoneList[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calls' | 'phones' | 'surveys' | 'analytics' | 'voice'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  async function checkAuth() {
    try {
      const userData = await getUser();
      setUser(userData);
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setAuthChecked(true);
    }
  }

  async function handleLogin() {
    await checkAuth();
  }

  async function handleLogout() {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching data from Supabase...");
      
      // Try API endpoint first to ensure we get the most recent data
      console.log("Fetching directly from API endpoint...");
      const apiResponse = await fetch('/api/phone');
      const apiData = await apiResponse.json();
      
      if (apiData.phoneNumbers && apiData.phoneNumbers.length > 0) {
        console.log("Phone data from API:", apiData.phoneNumbers.length, "records");
        setPhoneList(apiData.phoneNumbers);
      } else {
        // Fall back to Supabase query
        console.log("No data from API, trying Supabase...");
        const { data: phoneData, error: phoneError } = await db
          .from('phone_list')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (phoneError) {
          console.error('Error fetching phone list from Supabase:', phoneError);
          throw phoneError;
        }
        
        console.log("Phone data from Supabase:", phoneData);
        
        // If no phone data, try to populate sample data
        if (!phoneData || phoneData.length === 0) {
          console.log("No phone data found, adding sample data...");
          const sampleResponse = await fetch('/api/phone', { method: 'PUT' });
          const sampleData = await sampleResponse.json();
          console.log("Sample phone data response:", sampleData);
          
          if (sampleData.phoneNumbers) {
            setPhoneList(sampleData.phoneNumbers);
          }
        } else {
          setPhoneList(phoneData);
        }
      }
      
      // Fetch questions data
      const { data: questionData, error: questionError } = await db
        .from('questions')
        .select('*');
      
      if (questionError) {
        console.error('Error fetching questions from Supabase:', questionError);
        throw questionError;
      }
      
      setQuestions(questionData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }

  // Show login screen if not authenticated
  if (authChecked && !user) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Primary Care Survey Dashboard</h1>
        <DirectLogin onSuccess={handleLogin} />
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Primary Care Survey Dashboard</h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Logged in as <span className="font-medium">{user.name || user.email}</span>
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`ml-4 md:ml-8 py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'calls'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Make Calls
            </button>
            <button
              onClick={() => setActiveTab('phones')}
              className={`ml-4 md:ml-8 py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'phones'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Phone Numbers
            </button>
            <button
              onClick={() => setActiveTab('surveys')}
              className={`ml-4 md:ml-8 py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'surveys'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Surveys
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`ml-4 md:ml-8 py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'voice'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Voice Survey
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`ml-4 md:ml-8 py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
          </nav>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">
          {error}
          <button 
            onClick={fetchData}
            className="ml-2 bg-red-100 px-2 py-1 rounded-md text-xs hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="p-12 flex justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Loading data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <CallHistory limit={5} onViewAnalytics={() => setActiveTab('analytics')} />
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
                <div className="space-y-2">
                  <p className="text-gray-700">
                    This dashboard allows you to conduct Primary Care Access Surveys via phone calls or voice conversation.
                  </p>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1 text-sm">
                    <li>Use the <strong>Make Calls</strong> tab to initiate survey calls</li>
                    <li>Manage your phone list in the <strong>Phone Numbers</strong> tab</li>
                    <li>Create and edit surveys in the <strong>Surveys</strong> tab</li>
                    <li>Use the <strong>Voice Survey</strong> tab for conversation-based surveys</li>
                    <li>View survey responses in the <strong>Dashboard</strong> tab</li>
                    <li>Analyze survey results in the <strong>Analytics</strong> tab</li>
                  </ul>
                  <p className="text-gray-700 text-sm mt-4">
                    All calls are automatically transcribed, and the responses are processed for both 
                    quantitative analysis (numeric values) and qualitative insights.
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'calls' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <InitiateCall 
                  phoneList={phoneList}
                  onCallInitiated={fetchData} 
                />
                <div className="mt-4 text-sm text-gray-500">
                  Phone numbers available: {phoneList.length}
                </div>
              </div>
              <CallHistory limit={10} onViewAnalytics={() => setActiveTab('analytics')} />
            </div>
          )}
          {activeTab === 'phones' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <PhoneManager onPhoneAdded={fetchData} />
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Phone List</h2>
                {phoneList.length === 0 ? (
                  <p className="text-gray-600">No phone numbers added yet.</p>
                ) : (
                  <div className="overflow-y-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone Number
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {phoneList.map((phone) => (
                          <tr key={phone.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {phone.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {phone.phone_number}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'surveys' && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <SurveyManager onSurveyUpdated={fetchData} />
            </div>
          )}
          {activeTab === 'voice' && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <VoiceSurvey />
            </div>
          )}
          {activeTab === 'analytics' && (
            <AnalyticsDashboard />
          )}
          {activeTab === 'calls' && (
            <div className="mt-8">
              <CallQueueManager phoneList={phoneList} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
