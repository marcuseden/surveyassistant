'use client';

import { useState } from 'react';
import type { PhoneList } from '@/lib/supabase/client';

interface PhoneManagerProps {
  onPhoneAdded: () => void;
}

export default function PhoneManager({ onPhoneAdded }: PhoneManagerProps) {
  // State for the single phone number form
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [singleFormError, setSingleFormError] = useState<string | null>(null);
  const [singleFormSuccess, setSingleFormSuccess] = useState<string | null>(null);
  
  // State for the CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Loading state
  const [loading, setLoading] = useState(false);

  // Function to add a single phone number
  async function handleAddPhoneNumber(e: React.FormEvent) {
    e.preventDefault();
    
    // Reset states
    setSingleFormError(null);
    setSingleFormSuccess(null);
    
    // Validate form
    if (!name.trim()) {
      setSingleFormError('Please enter a name');
      return;
    }
    
    if (!phoneNumber.trim()) {
      setSingleFormError('Please enter a phone number');
      return;
    }
    
    // Validate phone number format (basic validation for E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setSingleFormError('Phone number must be in E.164 format (e.g., +12125551234)');
      return;
    }
    
    try {
      setLoading(true);
      
      // Send API request to add the phone number
      const response = await fetch('/api/phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, phone_number: phoneNumber }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add phone number');
      }
      
      const data = await response.json();
      
      // Reset form
      setName('');
      setPhoneNumber('');
      setSingleFormSuccess(`Phone number for ${data.phoneNumber?.name || name} added successfully`);
      
      // Immediate refresh of phone list
      setTimeout(() => {
        // Notify parent component
        onPhoneAdded();
      }, 500);
      
    } catch (error) {
      console.error('Error adding phone number:', error);
      setSingleFormError(error.message || 'An error occurred while adding the phone number');
    } finally {
      setLoading(false);
    }
  }
  
  // Function to parse CSV file and add phone numbers
  async function handleCsvUpload(e: React.FormEvent) {
    e.preventDefault();
    
    // Reset states
    setCsvError(null);
    setCsvSuccess(null);
    
    if (!csvFile) {
      setCsvError('Please select a CSV file');
      return;
    }
    
    try {
      setUploading(true);
      
      // Read the CSV file
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const csvData = event.target?.result as string;
          const lines = csvData.split('\n');
          
          // Skip header row if it exists
          const startIndex = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('phone') ? 1 : 0;
          
          // Parse CSV rows
          const phoneEntries = [];
          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(',');
            if (values.length < 2) continue;
            
            const name = values[0].trim();
            const phone_number = values[1].trim();
            
            // Basic validation
            if (!name || !phone_number) continue;
            
            phoneEntries.push({ name, phone_number });
          }
          
          if (phoneEntries.length === 0) {
            throw new Error('No valid phone entries found in the CSV file');
          }
          
          // Send the data to the API
          const response = await fetch('/api/phone/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phoneEntries }),
          });
          
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to upload CSV file');
          }
          
          const data = await response.json();
          
          // Reset form
          setCsvFile(null);
          setCsvSuccess(`${data.count || phoneEntries.length} phone numbers added successfully`);
          
          // Clear the file input
          const fileInput = document.getElementById('csv-file') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          
          // Immediate refresh of phone list
          setTimeout(() => {
            // Notify parent component
            onPhoneAdded();
          }, 500);
          
        } catch (error) {
          console.error('Error processing CSV:', error);
          setCsvError(error.message || 'An error occurred while processing the CSV file');
        } finally {
          setUploading(false);
        }
      };
      
      fileReader.onerror = () => {
        setCsvError('Failed to read the CSV file');
        setUploading(false);
      };
      
      fileReader.readAsText(csvFile);
      
    } catch (error) {
      console.error('Error uploading CSV:', error);
      setCsvError(error.message || 'An error occurred while uploading the CSV file');
      setUploading(false);
    }
  }
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Manage Phone Numbers</h2>
      
      {/* Add Single Phone Number Form */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-3">Add Single Phone Number</h3>
        
        {singleFormError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-3">
            {singleFormError}
          </div>
        )}
        
        {singleFormSuccess && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm mb-3">
            {singleFormSuccess}
          </div>
        )}
        
        <form onSubmit={handleAddPhoneNumber} className="space-y-3">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="John Doe"
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1">
              Phone Number (E.164 format)
            </label>
            <input
              id="phoneNumber"
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="+12125551234"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Phone number must be in E.164 format (e.g., +12125551234)
            </p>
          </div>
          
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Phone Number'}
          </button>
        </form>
      </div>
      
      {/* CSV Upload Form */}
      <div>
        <h3 className="text-lg font-medium mb-3">Upload Phone Numbers CSV</h3>
        
        {csvError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-3">
            {csvError}
          </div>
        )}
        
        {csvSuccess && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm mb-3">
            {csvSuccess}
          </div>
        )}
        
        <form onSubmit={handleCsvUpload} className="space-y-3">
          <div>
            <label htmlFor="csv-file" className="block text-sm font-medium mb-1">
              CSV File
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
              className="w-full p-2 border rounded"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 mt-1">
              CSV file should have columns for name and phone number (E.164 format)
            </p>
          </div>
          
          <button
            type="submit"
            className="bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:bg-green-300"
            disabled={uploading || !csvFile}
          >
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </form>
        
        <div className="mt-4 text-sm text-gray-600">
          <h4 className="font-medium">CSV Format Example:</h4>
          <pre className="bg-gray-100 p-2 rounded mt-1 text-xs">
            Name,PhoneNumber<br/>
            John Doe,+12125551234<br/>
            Jane Smith,+14155557890
          </pre>
        </div>
      </div>
    </div>
  );
} 