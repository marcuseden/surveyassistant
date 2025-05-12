#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Define the root directory to search (the whole project)
const ROOT_DIR = path.resolve(__dirname, '..');

// Text patterns to search for
const PATTERNS = [
  'createClient',
  'supabase =',
  'supabase=',
  'const supabase',
  'mockSupabase',
  'createMockSupabaseClient'
];

// Extensions to check
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

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
            if (content.includes(pattern)) {
              if (!results[fullPath]) {
                results[fullPath] = [];
              }
              
              const lines = content.split('\n');
              const matchingLines = [];
              
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(pattern)) {
                  const lineNumber = i + 1;
                  const lineContent = lines[i].trim();
                  
                  // Get context (2 lines before and after)
                  const startLine = Math.max(0, i - 2);
                  const endLine = Math.min(lines.length - 1, i + 2);
                  const context = [];
                  
                  for (let j = startLine; j <= endLine; j++) {
                    if (j === i) {
                      context.push(`> ${lineNumber}: ${lineContent}`);
                    } else {
                      context.push(`  ${j + 1}: ${lines[j].trim()}`);
                    }
                  }
                  
                  matchingLines.push({
                    line: lineNumber,
                    content: lineContent,
                    context: context.join('\n')
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

console.log(`Searching for Supabase client implementations in ${ROOT_DIR}...`);
const results = searchDirectory(ROOT_DIR, PATTERNS);

if (Object.keys(results).length === 0) {
  console.log('No Supabase client implementations found.');
} else {
  console.log(`Found ${Object.keys(results).length} files with Supabase client implementations:`);
  
  for (const [file, matches] of Object.entries(results)) {
    console.log(`\nFILE: ${file}`);
    
    for (const match of matches) {
      console.log(`  PATTERN: "${match.pattern}"`);
      
      for (const line of match.lines) {
        console.log(`\n    Line ${line.line}: ${line.content}`);
        console.log(`    Context:\n${line.context}`);
      }
    }
  }
} 