const { spawn } = require('child_process');
const path = require('path');

// Set environment variables
process.env.FORCE_REAL_DB = 'true';

console.log('Starting development server with FORCE_REAL_DB=true');
console.log('This will force the application to use the real Supabase database');

// Spawn the next dev process with the environment variable
const nextDev = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, FORCE_REAL_DB: 'true' }
});

// Handle process events
nextDev.on('error', (error) => {
  console.error('Failed to start development server:', error);
});

nextDev.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
}); 