// Simple script to test the Twilio response handling locally
const fetch = require('node-fetch');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Base URL for local testing
const baseUrl = 'http://localhost:3000';

// Total questions to simulate
let totalQuestions = 3;
let currentQuestion = 1;
let callSid = 'LOCAL_TEST_CALL_' + Date.now();

console.log('\n=== Twilio Voice Survey Test Tool ===');
console.log('This tool simulates a Twilio voice call locally.');
console.log('You can type "interrupt" at any time to test the interruption feature.\n');

// Function to simulate a Twilio response
async function simulateTwilioResponse(speechResult, questionNum = 1) {
  try {
    // Create form data like Twilio would send
    const params = new URLSearchParams();
    params.append('SpeechResult', speechResult);
    params.append('CallSid', callSid);
    
    console.log(`\nSending response "${speechResult}" for question ${questionNum}/${totalQuestions}`);
    
    // Send request to the response endpoint
    const response = await fetch(
      `${baseUrl}/api/twilio/response?question=${questionNum}&totalQuestions=${totalQuestions}&callSid=${callSid}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // Get the TwiML response
    const twimlText = await response.text();
    
    // Parse the TwiML to extract what would be spoken
    const sayMatches = twimlText.match(/<Say[^>]*>(.*?)<\/Say>/g);
    const playMatches = twimlText.match(/<Play>(.*?)<\/Play>/g);
    
    console.log('\n--- AI would say: ---');
    if (sayMatches) {
      sayMatches.forEach(match => {
        const content = match.replace(/<Say[^>]*>(.*?)<\/Say>/, '$1');
        console.log(`"${content}"`);
      });
    }
    
    if (playMatches) {
      playMatches.forEach(match => {
        const url = match.replace(/<Play>(.*?)<\/Play>/, '$1');
        console.log(`[Would play audio from: ${url}]`);
      });
    }
    
    // Check if this is the last question
    if (twimlText.includes('<Hangup />')) {
      console.log('\nCall completed. Survey finished.');
      rl.close();
      return;
    }
    
    // Determine the next question number from the TwiML
    const nextQuestionMatch = twimlText.match(/question=(\d+)/);
    if (nextQuestionMatch) {
      currentQuestion = parseInt(nextQuestionMatch[1]);
    } else {
      currentQuestion++;
    }
    
    // Prompt for next response
    promptForResponse();
  } catch (error) {
    console.error('Error simulating response:', error);
    rl.close();
  }
}

// Function to prompt user for response
function promptForResponse() {
  rl.question('\nYour response (or type "interrupt" to test interruption): ', (answer) => {
    if (answer.toLowerCase() === 'interrupt') {
      console.log('\n[User interrupted the AI while speaking]');
      // Simulate interruption by sending a response with the special interrupt flag
      simulateTwilioResponse('interrupted', currentQuestion);
    } else if (answer.toLowerCase() === 'exit' || answer.toLowerCase() === 'quit') {
      console.log('Exiting test.');
      rl.close();
    } else {
      simulateTwilioResponse(answer, currentQuestion);
    }
  });
}

// Start the simulation
console.log('Starting simulated call with SID:', callSid);
console.log('AI: "Hello, this is an AI research assistant calling about a healthcare survey."');
console.log('AI: "I\'d like to ask you a few quick questions about your healthcare experience."');
console.log('AI: "Your feedback will really help improve services in your area. Is that okay?"\n');

// Start the interaction
promptForResponse();

// Handle closing
rl.on('close', () => {
  console.log('\nTest call ended.');
  process.exit(0);
}); 