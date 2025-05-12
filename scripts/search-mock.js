#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the root directory to search (the whole project)
const ROOT_DIR = path.resolve(__dirname, '..');

// Text patterns to search for
const PATTERNS = [
  'mock',
  'Using mock',
  'createMock',
  'MockSupabase',
  'mockSupabase',
  'mockClient',
  'mockDb'
];

// Extensions to check
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

// Function to check if a file has one of the allowed extensions
function hasAllowedExtension(file) {
  return FILE_EXTENSIONS.some(ext => file.endsWith(ext));
}

// Find files that match the pattern
function searchDirectory(directory, patterns, results = {}) {
  try {
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const fullPath = path.join(directory, item);
      
      // Skip node_modules and .next
      if (item === 'node_modules' || item === '.next' || item === '.git') {
        continue;
      }
      
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        searchDirectory(fullPath, patterns, results);
      } else if (stats.isFile() && hasAllowedExtension(item)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          for (const pattern of patterns) {
            if (content.toLowerCase().includes(pattern.toLowerCase())) {
              if (!results[fullPath]) {
                results[fullPath] = [];
              }
              
              const lines = content.split('\n');
              const matchingLines = [];
              
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(pattern.toLowerCase())) {
                  matchingLines.push({
                    line: i + 1, 
                    content: lines[i].trim()
                  });
                }
              }
              
              results[fullPath].push({
                pattern,
                lines: matchingLines
              });
            }
          }
        } catch (error) {
          console.error(`Error reading file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error accessing directory ${directory}:`, error);
  }
  
  return results;
}

console.log(`Searching for mock implementations in ${ROOT_DIR}...`);
const results = searchDirectory(ROOT_DIR, PATTERNS);

if (Object.keys(results).length === 0) {
  console.log('No files found with mock implementations.');
} else {
  console.log(`Found ${Object.keys(results).length} files with mock implementations:`);
  
  for (const [file, matches] of Object.entries(results)) {
    console.log(`\nFILE: ${file}`);
    
    for (const match of matches) {
      console.log(`  PATTERN: "${match.pattern}"`);
      
      for (const line of match.lines) {
        console.log(`    Line ${line.line}: ${line.content}`);
      }
    }
  }
} 