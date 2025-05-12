'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/forceRealClient';

interface QuestionImporterProps {
  onQuestionsImported: () => void;
}

interface ParsedQuestion {
  question_id?: string;
  section?: string;
  question_text: string;
  response_type?: string;
  options?: string[];
  follow_up_trigger?: string;
  follow_up_text?: string;
  is_follow_up: boolean;
  parent_question_id: string | null;
}

export default function QuestionImporter({ onQuestionsImported }: QuestionImporterProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!csvFile) {
      setError('Please select a CSV file');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const csvData = event.target?.result as string;
          const questions = parseComplexCsvFormat(csvData);
          
          // Check if we found any questions
          if (questions.length === 0) {
            setError('No valid questions found in the CSV file');
            setLoading(false);
            return;
          }
          
          // Map of question IDs to DB IDs for linking follow-ups
          const questionIdMap: Record<string, string> = {};
          
          // Process and save main questions first
          const mainQuestions = questions.filter(q => !q.is_follow_up);
          
          for (const question of mainQuestions) {
            try {
              // Save to database
              const { data, error: dbError } = await supabase
                .from('questions')
                .insert({
                  question_text: question.question_text,
                  is_follow_up: false,
                  parent_question_id: null,
                  // Save additional metadata as extra properties
                  metadata: {
                    question_id: question.question_id,
                    section: question.section,
                    response_type: question.response_type,
                    options: question.options,
                    follow_up_trigger: question.follow_up_trigger
                  }
                })
                .select()
                .single();
                
              if (dbError) throw dbError;
              
              // Store mapping of question ID to database ID
              if (question.question_id && data) {
                questionIdMap[question.question_id] = data.id;
              }
            } catch (error) {
              console.error(`Error importing question ${question.question_id}:`, error);
            }
          }
          
          // Now process follow-up questions
          const followUpQuestions = questions.filter(q => q.is_follow_up);
          
          for (const question of followUpQuestions) {
            try {
              // Find parent question ID in our map
              const parentDbId = question.parent_question_id && questionIdMap[question.parent_question_id] 
                ? questionIdMap[question.parent_question_id] 
                : null;
              
              // Save to database with parent reference
              const { data, error: dbError } = await supabase
                .from('questions')
                .insert({
                  question_text: question.question_text,
                  is_follow_up: true,
                  parent_question_id: parentDbId,
                  // Save additional metadata
                  metadata: {
                    question_id: question.question_id,
                    section: question.section,
                    response_type: question.response_type,
                    options: question.options
                  }
                })
                .select()
                .single();
                
              if (dbError) throw dbError;
              
              // Store mapping of question ID to database ID
              if (question.question_id && data) {
                questionIdMap[question.question_id] = data.id;
              }
            } catch (error) {
              console.error(`Error importing follow-up question ${question.question_id}:`, error);
            }
          }
          
          setSuccess(`Successfully imported ${questions.length} questions (${mainQuestions.length} main, ${followUpQuestions.length} follow-up)`);
          
          // Reset form
          setCsvFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          
          // Notify parent
          onQuestionsImported();
        } catch (error) {
          console.error('Error importing questions:', error);
          setError('Error importing questions: ' + (error.message || 'Unknown error'));
        } finally {
          setLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError('Error reading the CSV file');
        setLoading(false);
      };
      
      reader.readAsText(csvFile);
    } catch (error) {
      console.error('Error handling file:', error);
      setError('Error handling file: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
  };
  
  // Function to parse the complex CSV format
  const parseComplexCsvFormat = (csvData: string): ParsedQuestion[] => {
    const parsedQuestions: ParsedQuestion[] = [];
    
    try {
      // Split by lines but handle potential commas within quotes
      const lines = csvData.split(/\r?\n/);
      
      // Identify header row and column indexes
      const headerRow = lines[0];
      if (!headerRow) return [];
      
      // Parse header for column positions
      const headers = parseCSVRow(headerRow);
      const columnMap: Record<string, number> = {};
      
      // Define our expected columns and map them to their indexes
      const expectedColumns = [
        'Question_ID', 'Section', 'Question_Text', 'Response_Type',
        'Options', 'Follow_Up_Trigger', 'Follow_Up_Text'
      ];
      
      expectedColumns.forEach(col => {
        const index = headers.findIndex(header => 
          header.trim().toLowerCase() === col.toLowerCase() ||
          header.trim().toLowerCase().replace(/[_\s]/g, '') === col.toLowerCase().replace(/[_\s]/g, '')
        );
        if (index !== -1) {
          columnMap[col] = index;
        }
      });
      
      // Skip first row (header) and process each question row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const row = parseCSVRow(line);
        if (row.length < 3) continue; // Basic validation
        
        const questionId = columnMap['Question_ID'] >= 0 ? row[columnMap['Question_ID']] : '';
        const section = columnMap['Section'] >= 0 ? row[columnMap['Section']] : '';
        const questionText = columnMap['Question_Text'] >= 0 
          ? row[columnMap['Question_Text']] 
          : row[0]; // Fallback to first column
          
        const responseType = columnMap['Response_Type'] >= 0 ? row[columnMap['Response_Type']] : '';
        
        // Parse options columns (they might span multiple columns)
        const options: string[] = [];
        if (columnMap['Options'] >= 0) {
          let optionIdx = columnMap['Options'];
          while (optionIdx < row.length && row[optionIdx] && !isSpecialColumn(row[optionIdx], expectedColumns)) {
            if (row[optionIdx].trim()) {
              options.push(row[optionIdx].trim());
            }
            optionIdx++;
          }
        }
        
        // Check for follow-up
        const followUpTrigger = columnMap['Follow_Up_Trigger'] >= 0 ? row[columnMap['Follow_Up_Trigger']] : '';
        const followUpText = columnMap['Follow_Up_Text'] >= 0 ? row[columnMap['Follow_Up_Text']] : '';
        
        // Detect if this is a follow-up question based on ID format (e.g., Q6_Follow_Up)
        const isFollowUp = questionId.includes('_Follow_Up');
        
        // Find parent question ID if this is a follow-up
        let parentQuestionId: string | null = null;
        if (isFollowUp) {
          parentQuestionId = questionId.split('_Follow_Up')[0];
        }
        
        // Skip empty questions
        if (!questionText.trim()) continue;
        
        parsedQuestions.push({
          question_id: questionId,
          section,
          question_text: questionText,
          response_type: responseType,
          options,
          follow_up_trigger: followUpTrigger,
          follow_up_text: followUpText,
          is_follow_up: isFollowUp,
          parent_question_id: parentQuestionId
        });
        
        // If this question has a follow-up text, create a follow-up question
        if (followUpText && followUpText.trim() && !isFollowUp) {
          parsedQuestions.push({
            question_id: `${questionId}_Follow_Up`,
            section,
            question_text: followUpText,
            response_type: responseType, // Inherit response type
            options: [], // Follow-up options will be empty initially
            is_follow_up: true,
            parent_question_id: questionId
          });
        }
      }
      
      return parsedQuestions;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return [];
    }
  };
  
  // Parse a CSV row handling quoted values
  const parseCSVRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === '\t' && !inQuotes) {
        // Tab is our delimiter in this format
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current);
    
    return result;
  };
  
  // Check if a value is a special column header
  const isSpecialColumn = (value: string, expectedColumns: string[]): boolean => {
    const normalizedValue = value.trim().toLowerCase();
    return expectedColumns.some(col => 
      normalizedValue === col.toLowerCase() || 
      normalizedValue === col.toLowerCase().replace(/[_\s]/g, '')
    );
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        setCsvFile(file);
      } else {
        setError('Please drop a CSV or text file');
      }
    }
  };
  
  const downloadSampleCsv = () => {
    const sampleTSV = 
`Question_ID\tSection\tQuestion_Text\tResponse_Type\tOptions\tOptions\tOptions\tOptions\tOptions\tFollow_Up_Trigger\tFollow_Up_Text
Q1\tAccessing Primary Care\tDo you have a primary care doctor you see regularly?\tMultiple-Choice\tYes\tNo\tI don't know\t\t\tNo\tCan you tell me why not? For example, you don't need one, can't find one, or it's too expensive.
Q2\tAccessing Primary Care\tHow do you usually contact your primary care doctor?\tMultiple-Choice\tPhone\tOnline\tIn-person\tEmail\tOther\tOther\tWhat other way do you use?
Q3\tBarriers to Access\tWhat is the biggest barrier to accessing primary care for you?\tOpen-Ended\t\t\t\t\t\t\t`;
    
    const blob = new Blob([sampleTSV], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_questions.tsv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="bg-white p-4 rounded-md border border-gray-200 mb-4">
      <h3 className="font-medium text-lg mb-2">Import Questions from CSV/TSV</h3>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-3">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm mb-3">
          {success}
        </div>
      )}
      
      <form onSubmit={handleCsvUpload} className="space-y-3">
        <div>
          <label htmlFor="question-csv" className="block text-sm font-medium mb-1">
            Upload Tab-Separated Question File
          </label>
          <div 
            className={`border-2 border-dashed p-6 rounded-md text-center cursor-pointer 
              ${isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg 
              className="w-10 h-10 mx-auto text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            
            <p className="mt-2 text-sm text-gray-600">
              {csvFile ? csvFile.name : 'Drag & drop your TSV file here or click to browse'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Tab-separated format with Question_ID, Section, Question_Text columns
            </p>
            
            <input
              ref={fileInputRef}
              id="question-csv"
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
              className="hidden"
              disabled={loading}
            />
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">TSV Format Example:</h4>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Download Sample TSV
            </button>
          </div>
          <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-2 py-1 border-b">Question_ID</th>
                  <th className="px-2 py-1 border-b">Section</th>
                  <th className="px-2 py-1 border-b">Question_Text</th>
                  <th className="px-2 py-1 border-b">Response_Type</th>
                  <th className="px-2 py-1 border-b" colSpan={5}>Options</th>
                  <th className="px-2 py-1 border-b">Follow_Up_Trigger</th>
                  <th className="px-2 py-1 border-b">Follow_Up_Text</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1">Q1</td>
                  <td className="px-2 py-1">Primary Care</td>
                  <td className="px-2 py-1">Do you have a doctor?</td>
                  <td className="px-2 py-1">Multiple-Choice</td>
                  <td className="px-2 py-1">Yes</td>
                  <td className="px-2 py-1">No</td>
                  <td className="px-2 py-1">I don't know</td>
                  <td className="px-2 py-1"></td>
                  <td className="px-2 py-1"></td>
                  <td className="px-2 py-1">No</td>
                  <td className="px-2 py-1">Why not?</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2 text-gray-500">
            File should use tab character as delimiter. Follow-up questions will be automatically created.
          </p>
        </div>
        
        <div className="flex flex-col xs:flex-row gap-2">
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-blue-300 flex-1"
            disabled={loading || !csvFile}
          >
            {loading ? 'Importing...' : 'Import Questions'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setCsvFile(null);
              setError(null);
              setSuccess(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              onQuestionsImported();
            }}
            className="bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
} 