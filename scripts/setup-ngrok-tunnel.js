// Script to set up ngrok tunnel for Twilio to access our local server
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Check if ngrok is installed
function checkNgrok() {
  return new Promise((resolve, reject) => {
    exec('npx ngrok --version', (error, stdout, stderr) => {
      if (error) {
        console.log('ngrok not found, installing...');
        exec('npm install -g ngrok', (error, stdout, stderr) => {
          if (error) {
            reject(new Error('Failed to install ngrok. Please install it manually with: npm install -g ngrok'));
            return;
          }
          resolve(true);
        });
      } else {
        console.log('ngrok found:', stdout.trim());
        resolve(true);
      }
    });
  });
}

// Start the local express server
function startLocalServer() {
  console.log('Starting the local server...');
  
  // Start server as a detached process so it runs in the background
  const server = spawn('node', ['scripts/serve-audio-files.js'], {
    detached: true,
    stdio: 'inherit'
  });
  
  // Unref the child process so the parent can exit independently
  server.unref();
  
  console.log('Local server started!');
}

// Start the ngrok tunnel
function startNgrokTunnel() {
  return new Promise((resolve, reject) => {
    console.log('Starting ngrok tunnel...');
    
    // Start ngrok to expose port 3000
    const ngrok = spawn('npx', ['ngrok', 'http', '3000'], {
      stdio: ['inherit', 'pipe', 'inherit']
    });
    
    let tunnelUrl = '';
    
    // Listen for data from stdout to get the tunnel URL
    ngrok.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Look for the https forwarding URL
      const match = output.match(/Forwarding\s+(https:\/\/[a-z0-9-]+\.ngrok-free\.app)/i);
      if (match && match[1]) {
        tunnelUrl = match[1];
        console.log(`ngrok tunnel established: ${tunnelUrl}`);
        
        // Update the BASE_URL environment variable in .env.local
        let envContent = '';
        try {
          if (fs.existsSync('.env.local')) {
            envContent = fs.readFileSync('.env.local', 'utf8');
          }
          
          // Replace existing BASE_URL or add a new one
          if (envContent.includes('BASE_URL=')) {
            envContent = envContent.replace(/BASE_URL=.*/, `BASE_URL=${tunnelUrl}`);
          } else {
            envContent += `\nBASE_URL=${tunnelUrl}\n`;
          }
          
          fs.writeFileSync('.env.local', envContent);
          console.log(`Updated .env.local with BASE_URL=${tunnelUrl}`);
        } catch (error) {
          console.error('Error updating .env.local:', error);
        }
        
        resolve(tunnelUrl);
      }
    });
    
    // Listen for process exit
    ngrok.on('close', (code) => {
      if (!tunnelUrl) {
        reject(new Error(`ngrok exited with code ${code} before establishing a tunnel`));
      }
    });
  });
}

// Main function
async function main() {
  try {
    // Check if ngrok is installed
    await checkNgrok();
    
    // Start the local server
    startLocalServer();
    
    // Give the server a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start the ngrok tunnel
    const tunnelUrl = await startNgrokTunnel();
    
    console.log('\n===================================================');
    console.log('SETUP COMPLETE!');
    console.log('===================================================');
    console.log(`Your local server is now accessible at: ${tunnelUrl}`);
    console.log('\nThis URL will be used for the Twilio webhooks and audio files.');
    console.log('\nTo make a test call with ElevenLabs, run:');
    console.log(`NODE_ENV=production BASE_URL=${tunnelUrl} node scripts/test-elevenlabs-call.js --call --phone=2 --voice=JOSH`);
    console.log('\nKeep this terminal window open to maintain the tunnel.');
    console.log('Press Ctrl+C to stop the tunnel when you\'re done testing.');
    console.log('===================================================\n');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main(); 