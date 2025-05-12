'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/forceRealClient';

export default function DirectSurveyPage() {
  const [name, setName] = useState('Test Survey');
  const [description, setDescription] = useState('A test survey description');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [surveys, setSurveys] = useState<any[]>([]);
  
  useEffect(() => {
    fetchSurveys();
  }, []);
  
  async function fetchSurveys() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching surveys:', error);
        setError(`Failed to load surveys: ${error.message}`);
      } else {
        setSurveys(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleCreateSurvey(e: React.FormEvent) {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Survey name is required');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Create a new survey
      const { data, error } = await supabase
        .from('surveys')
        .insert([
          { name, description }
        ])
        .select();
      
      if (error) {
        console.error('Error creating survey:', error);
        setError(`Failed to create survey: ${error.message}`);
      } else {
        setSuccess(`Survey "${name}" created successfully!`);
        setName('');
        setDescription('');
        fetchSurveys();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleDeleteSurvey(id: string) {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting survey:', error);
        setError(`Failed to delete survey: ${error.message}`);
      } else {
        setSuccess('Survey deleted successfully');
        fetchSurveys();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="container mx-auto p-8 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Direct Survey Creation</h1>
      <p className="mb-4 text-sm text-gray-600">This page bypasses the normal flow and directly uses the real Supabase client.</p>
      
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
      
      <form onSubmit={handleCreateSurvey} className="mb-8 space-y-4 bg-white p-6 rounded-lg shadow-md">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Survey Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
            rows={3}
          />
        </div>
        
        <div>
          <button
            type="submit"
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Survey'}
          </button>
        </div>
      </form>
      
      <h2 className="text-xl font-semibold mb-4">Existing Surveys</h2>
      
      {loading && <p className="text-gray-500">Loading...</p>}
      
      {!loading && surveys.length === 0 && (
        <p className="text-gray-500">No surveys found.</p>
      )}
      
      <div className="space-y-4">
        {surveys.map(survey => (
          <div key={survey.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{survey.name}</h3>
                <p className="text-sm text-gray-600">{survey.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Created: {new Date(survey.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDeleteSurvey(survey.id)}
                className="text-red-600 hover:text-red-800 text-sm"
                disabled={loading}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 