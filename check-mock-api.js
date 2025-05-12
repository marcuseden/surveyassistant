#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the root directory to search
const ROOT_DIR = path.resolve(__dirname, 'src');

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

// Exclude node_modules and .next directories
function shouldSearchDir(dir) {
  const basename = path.basename(dir);
  return basename !== 'node_modules' && basename !== '.next';
}

// Find files that match the pattern
function findFiles(directory, matches = {}) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory() && shouldSearchDir(fullPath)) {
      findFiles(fullPath, matches);
    } else if (stats.isFile() && /\.(js|jsx|ts|tsx)$/.test(file)) {
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
  console.log('Searching for mock database usage...');
  const matches = findFiles(ROOT_DIR);
  
  if (Object.keys(matches).length === 0) {
    console.log('No files found with mock database references.');
    return;
  }
  
  console.log('\nFiles containing mock database references:');
  for (const [file, patterns] of Object.entries(matches)) {
    console.log(`\n${file}:`);
    console.log(`  Patterns found: ${patterns.join(', ')}`);
    
    // Show some context for each match
    for (const pattern of patterns) {
      try {
        const grep = execSync(`grep -n "${pattern}" "${file}"`, { encoding: 'utf8' });
        console.log(`  Context for "${pattern}":`);
        console.log('    ' + grep.replace(/\n/g, '\n    '));
      } catch (error) {
        // grep returns non-zero exit code if no matches, which causes an error
        if (error.status !== 1) {
          console.error(`  Error getting context: ${error.message}`);
        }
      }
    }
  }
}

main(); 