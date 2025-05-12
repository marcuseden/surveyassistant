#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the root directory to search
const ROOT_DIR = path.resolve(__dirname, '.next');

// Text patterns to search for
const PATTERNS = [
  'Using mock Supabase client',
  'mockPhones',
  'mockQuestions',
  'mockSurveys',
  'mockResponses',
  'mockSurveyQuestions',
  'createMockSupabaseClient',
  'usingMockClient'
];

// Find files that match the pattern
function findFiles(directory, matches = {}) {
  if (!fs.existsSync(directory)) {
    console.log(`Directory ${directory} does not exist.`);
    return matches;
  }
  
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      findFiles(fullPath, matches);
    } else if (stats.isFile() && /\.(js|json)$/.test(file)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        for (const pattern of PATTERNS) {
          if (content.includes(pattern)) {
            if (!matches[fullPath]) {
              matches[fullPath] = [];
            }
            matches[fullPath].push(pattern);
          }
        }
      } catch (error) {
        console.error(`Error reading file ${fullPath}:`, error);
      }
    }
  }
  
  return matches;
}

// Main function
function main() {
  console.log('Searching for mock database usage in .next directory...');
  const matches = findFiles(ROOT_DIR);
  
  if (Object.keys(matches).length === 0) {
    console.log('No files found with mock database references.');
    return;
  }
  
  console.log('\nFiles containing mock database references:');
  for (const [file, patterns] of Object.entries(matches)) {
    console.log(`\n${file}:`);
    console.log(`  Patterns found: ${patterns.join(', ')}`);
  }
}

main(); 