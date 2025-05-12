'use client';

import { useState, useEffect } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsDashboardProps {}

interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  responseCount: number;
  numericStats: {
    count: number;
    avg: number | null;
    distribution: Record<string, number>;
  };
  insights: string[];
}

interface OverallStats {
  totalResponses: number;
  responsesWithNumericValue: number;
  responsesWithInsights: number;
  responsesByDate: Array<{ date: string; count: number }>;
  columnsStatus: { hasNumericValueColumn: boolean; hasKeyInsightsColumn: boolean };
}

interface AnalyticsData {
  questionBreakdown: QuestionAnalytics[];
  overallStats: OverallStats;
  survey: {
    name: string;
    description: string;
    questionCount: number;
  };
}

// Add a component to show SQL instructions to add missing columns
function DatabaseMigrationInstructions({ columnsStatus }: { columnsStatus: { hasNumericValueColumn: boolean, hasKeyInsightsColumn: boolean } }) {
  if (columnsStatus.hasNumericValueColumn && columnsStatus.hasKeyInsightsColumn) {
    return null;
  }
  
  return (
    <div className="mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
      <h3 className="text-lg font-medium text-yellow-700 mb-2">Database Schema Update Required</h3>
      
      <p className="text-sm text-yellow-700 mb-3">
        Some columns are missing from your database. To enable full analytics functionality, please run the following SQL in your Supabase dashboard:
      </p>
      
      <div className="bg-gray-800 text-gray-100 p-3 rounded text-sm font-mono overflow-x-auto">
        <pre>
          {`-- Run this in the SQL editor in your Supabase dashboard
ALTER TABLE responses 
${!columnsStatus.hasNumericValueColumn ? 'ADD COLUMN IF NOT EXISTS numeric_value INTEGER,\n' : ''}${!columnsStatus.hasKeyInsightsColumn ? 'ADD COLUMN IF NOT EXISTS key_insights TEXT;\n' : ''}`}
        </pre>
      </div>
      
      <p className="text-xs text-yellow-600 mt-2">
        After adding these columns, you can populate them with data using the scripts provided in your project.
      </p>
    </div>
  );
}

export default function AnalyticsDashboard({}: AnalyticsDashboardProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<Array<{id: string, name: string}>>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);

  // Fetch available surveys first
  useEffect(() => {
    fetchSurveys();
  }, []);
  
  // Fetch analytics when selected survey changes
  useEffect(() => {
    if (selectedSurvey) {
      fetchAnalytics(selectedSurvey);
    }
  }, [selectedSurvey]);
  
  async function fetchSurveys() {
    try {
      setLoading(true);
      const response = await fetch('/api/surveys');
      
      if (!response.ok) {
        throw new Error('Failed to fetch surveys');
      }
      
      const data = await response.json();
      setSurveys(data.surveys || []);
      
      // Select the first survey by default
      if (data.surveys && data.surveys.length > 0) {
        setSelectedSurvey(data.surveys[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
      setError('Failed to load survey list. Please try again later.');
      setLoading(false);
    }
  }

  async function fetchAnalytics(surveyId: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics?surveyId=${surveyId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      
      // Set the first question as selected by default
      if (data.questionBreakdown && data.questionBreakdown.length > 0) {
        setSelectedQuestion(data.questionBreakdown[0].questionId);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  // Get the selected question data
  const selectedQuestionData = selectedQuestion && analyticsData
    ? analyticsData.questionBreakdown.find(q => q.questionId === selectedQuestion)
    : null;

  // Prepare data for the distribution chart
  const getDistributionChartData = () => {
    if (!selectedQuestionData || !selectedQuestionData.numericStats.distribution) {
      return null;
    }

    const distribution = selectedQuestionData.numericStats.distribution;
    const labels = Object.keys(distribution).sort((a, b) => Number(a) - Number(b));
    const values = labels.map(label => distribution[label]);

    return {
      labels,
      datasets: [
        {
          label: 'Response Distribution',
          data: values,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  // Prepare data for responses over time chart
  const getResponsesOverTimeData = () => {
    if (!analyticsData || !analyticsData.overallStats.responsesByDate) {
      return null;
    }

    const responsesByDate = [...analyticsData.overallStats.responsesByDate]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      labels: responsesByDate.map(item => item.date),
      datasets: [
        {
          label: 'Responses per Day',
          data: responsesByDate.map(item => item.count),
          fill: false,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.1,
        },
      ],
    };
  };

  // Get percentage of responses with numeric values
  const getNumericValuePercentage = () => {
    if (!analyticsData) return 0;
    
    const { totalResponses, responsesWithNumericValue } = analyticsData.overallStats;
    return totalResponses ? Math.round((responsesWithNumericValue / totalResponses) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Survey Analytics</h2>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Survey Analytics</h2>
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Survey Analytics</h2>
        <p>No analytics data available.</p>
      </div>
    );
  }

  const distributionData = getDistributionChartData();
  const responsesOverTimeData = getResponsesOverTimeData();

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Primary Care Survey Analytics</h2>
      
      {/* Show migration instructions if needed */}
      {analyticsData && analyticsData.overallStats.columnsStatus && (
        <DatabaseMigrationInstructions columnsStatus={analyticsData.overallStats.columnsStatus} />
      )}
      
      {/* Survey Selector */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="w-full md:w-1/3">
            <label htmlFor="surveySelect" className="block text-sm font-medium text-gray-700 mb-1">
              Select Survey:
            </label>
            <select
              id="surveySelect"
              value={selectedSurvey || ''}
              onChange={(e) => setSelectedSurvey(e.target.value)}
              className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || surveys.length === 0}
            >
              {surveys.length === 0 ? (
                <option value="">No surveys available</option>
              ) : (
                surveys.map(survey => (
                  <option key={survey.id} value={survey.id}>
                    {survey.name}
                  </option>
                ))
              )}
            </select>
          </div>
          
          {analyticsData && analyticsData.survey && (
            <div className="bg-white p-3 rounded-md border border-gray-100 w-full md:w-2/3">
              <h3 className="font-medium text-blue-600">{analyticsData.survey.name}</h3>
              {analyticsData.survey.description && (
                <p className="text-sm text-gray-600 mt-1">{analyticsData.survey.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {analyticsData.survey.questionCount} questions • {analyticsData.overallStats.totalResponses} total responses
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Responses</p>
          <p className="text-2xl font-bold">{analyticsData.overallStats.totalResponses}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Quantifiable Responses</p>
          <p className="text-2xl font-bold">{getNumericValuePercentage()}%</p>
          <p className="text-xs text-gray-500">({analyticsData.overallStats.responsesWithNumericValue} responses with numeric values)</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">With Key Insights</p>
          <p className="text-2xl font-bold">{analyticsData.overallStats.responsesWithInsights}</p>
        </div>
      </div>
      
      {/* Responses Over Time Chart */}
      {responsesOverTimeData && (
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Responses Over Time</h3>
          <div className="h-64">
            <Line 
              data={responsesOverTimeData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      precision: 0
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      )}
      
      {/* Question Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Question Analysis</h3>
        <select
          className="w-full p-2 border rounded"
          value={selectedQuestion || ''}
          onChange={(e) => setSelectedQuestion(e.target.value)}
        >
          {analyticsData.questionBreakdown.map((question) => (
            <option key={question.questionId} value={question.questionId}>
              {question.questionText.substring(0, 80)}...
            </option>
          ))}
        </select>
      </div>
      
      {/* Selected Question Analysis */}
      {selectedQuestionData && (
        <div className="border rounded-lg p-4 mb-6">
          <h3 className="text-md font-medium mb-2">{selectedQuestionData.questionText}</h3>
          <p className="text-sm text-gray-600 mb-4">Total Responses: {selectedQuestionData.responseCount}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribution Chart */}
            {distributionData && selectedQuestionData.numericStats.count > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">Response Distribution</h4>
                <div className="h-48">
                  <Bar 
                    data={distributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            precision: 0
                          }
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-center mt-2">
                  Average: {selectedQuestionData.numericStats.avg !== null ? selectedQuestionData.numericStats.avg : 'N/A'}
                </p>
              </div>
            )}
            
            {/* Key Insights */}
            <div>
              <h4 className="text-sm font-medium mb-2">Key Insights</h4>
              {selectedQuestionData.insights.length > 0 ? (
                <ul className="space-y-2">
                  {selectedQuestionData.insights.map((insight, index) => (
                    <li key={index} className="text-sm bg-gray-50 p-2 rounded">
                      {insight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No key insights available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 