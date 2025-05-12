'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Response } from '@/lib/supabase/client';
import Link from 'next/link';

interface CallHistoryProps {
  limit?: number;
  onViewAnalytics?: () => void;
}

interface CallHistoryItem extends Response {
  phone_list: {
    name: string;
    phone_number: string;
  };
  question: {
    question_text: string;
  };
  numeric_value?: number | null;
  key_insights?: string;
}

interface PatientSummary {
  name: string;
  phoneNumber: string;
  responseCount: number;
  lastResponseDate: string;
  averageRating?: number;
  id: string; // For key prop
}

export default function CallHistory({ limit = 10, onViewAnalytics }: CallHistoryProps) {
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [patientSummaries, setPatientSummaries] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCallHistory();
  }, [limit]);

  async function fetchCallHistory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('responses')
        .select(`
          *,
          phone_list (
            name,
            phone_number
          ),
          question: question_id (
            question_text
          )
        `)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      
      const allResponses = data as CallHistoryItem[];
      setHistory(allResponses);
      
      // Generate patient summaries
      const summariesByPhone: Record<string, PatientSummary> = {};
      
      allResponses.forEach(response => {
        const phoneNumber = response.phone_list.phone_number;
        
        if (!summariesByPhone[phoneNumber]) {
          summariesByPhone[phoneNumber] = {
            id: response.phone_list_id,
            name: response.phone_list.name,
            phoneNumber: phoneNumber,
            responseCount: 0,
            lastResponseDate: response.recorded_at,
            averageRating: undefined
          };
        }
        
        const summary = summariesByPhone[phoneNumber];
        summary.responseCount++;
        
        // Update last response date if this is more recent
        if (new Date(response.recorded_at) > new Date(summary.lastResponseDate)) {
          summary.lastResponseDate = response.recorded_at;
        }
        
        // Aggregate numeric values for average calculation
        if (response.numeric_value !== null && response.numeric_value !== undefined) {
          if (!summary.averageRating) {
            summary.averageRating = response.numeric_value;
          } else {
            // Crude running average - will be recalculated properly below
            summary.averageRating = (summary.averageRating + response.numeric_value) / 2;
          }
        }
      });
      
      // Recalculate averages properly
      for (const phoneNumber in summariesByPhone) {
        const relevantResponses = allResponses.filter(r => 
          r.phone_list.phone_number === phoneNumber && 
          r.numeric_value !== null && 
          r.numeric_value !== undefined
        );
        
        if (relevantResponses.length > 0) {
          const sum = relevantResponses.reduce((acc, r) => acc + (r.numeric_value || 0), 0);
          summariesByPhone[phoneNumber].averageRating = parseFloat((sum / relevantResponses.length).toFixed(1));
        }
      }
      
      // Convert to array and sort by most recent response
      const summaries = Object.values(summariesByPhone)
        .sort((a, b) => new Date(b.lastResponseDate).getTime() - new Date(a.lastResponseDate).getTime())
        .slice(0, limit);
      
      setPatientSummaries(summaries);
    } catch (error) {
      console.error('Error fetching call history:', error);
    } finally {
      setLoading(false);
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return 'LAST ATTEMPT';
  };

  // Get a color class based on numeric value (for visualizing scores)
  const getValueColorClass = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'bg-gray-100 text-gray-500';
    
    // For binary values (0-1)
    if (value === 0) return 'bg-red-100 text-red-700';
    if (value === 1) return 'bg-green-100 text-green-700';
    
    // For scale values (1-5)
    if (value <= 2) return 'bg-red-100 text-red-700';
    if (value <= 3) return 'bg-yellow-100 text-yellow-700';
    if (value <= 5) return 'bg-green-100 text-green-700';
    
    return 'bg-blue-100 text-blue-700';
  };

  const handleViewAnalytics = () => {
    if (onViewAnalytics) {
      onViewAnalytics();
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Primary Care Survey Summary</h2>
        <button 
          onClick={handleViewAnalytics}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          View Full Analytics
        </button>
      </div>
      
      {loading ? (
        <p>Loading survey results...</p>
      ) : (
        <div>
          <div className="mb-4">
            <p className="text-gray-700">
              <span className="font-medium">{history.length}</span> total responses from <span className="font-medium">{patientSummaries.length}</span> patients
            </p>
          </div>
          
          {patientSummaries.length === 0 ? (
            <p className="text-gray-500">No survey responses available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responses</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Response</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Rating</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patientSummaries.map((summary) => (
                    <tr key={summary.id + summary.phoneNumber} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{summary.name}</div>
                        <div className="text-sm text-gray-500">{summary.phoneNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{summary.responseCount}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(summary.lastResponseDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {summary.averageRating !== undefined ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getValueColorClass(summary.averageRating)}`}>
                            {summary.averageRating}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-4 text-right">
            <p className="text-xs text-gray-500">
              For detailed analysis and insights, visit the 
              <button 
                onClick={handleViewAnalytics}
                className="ml-1 text-blue-600 hover:underline focus:outline-none"
              >
                Analytics dashboard
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 