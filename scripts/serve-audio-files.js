// Simple Express server to serve audio files for Twilio
const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3000;

// Directory containing audio files
const audioDir = path.join(__dirname, '../public/audio');

// Make sure the audio directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log(`Created audio directory: ${audioDir}`);
}

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for Twilio
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Route to handle Twilio webhook for responses
app.post('/api/twilio/response', (req, res) => {
  console.log('Received response from Twilio:');
  console.log('- Query params:', req.query);
  console.log('- Request body:', req.body);
  
  // Get the question number and total questions
  const questionNum = parseInt(req.query.question) || 1;
  const totalQuestions = parseInt(req.query.totalQuestions) || 1;
  const callSid = req.query.callSid || req.body.CallSid;
  
  // Get the user's response
  const speechResult = req.body.SpeechResult || '';
  const digits = req.body.Digits || '';
  const userResponse = speechResult || digits || 'No response detected';
  
  console.log(`User response: "${userResponse}"`);
  
  // Handle special case of "yes" response
  if (userResponse.toLowerCase().includes('yes') && questionNum === 1) {
    console.log('Detected affirmative response to introduction, proceeding with questions');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Great! Let's start with the first question.</Say>
  <Pause length="0.5"/>
  <Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=1&amp;totalQuestions=${totalQuestions}&amp;callSid=${callSid}" method="POST">
    <Say>How would you rate your satisfaction with our services on a scale from 1 to 5?</Say>
    <Say>Please respond now.</Say>
  </Gather>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
    return;
  }
  
  // Check if there are more questions
  if (questionNum < totalQuestions) {
    // Send a TwiML response that continues to the next question
    console.log(`Moving to question ${questionNum + 1}/${totalQuestions}`);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for your answer. Moving to the next question.</Say>
  <Redirect method="POST">/api/twilio/next-question?question=${questionNum + 1}&amp;totalQuestions=${totalQuestions}&amp;callSid=${callSid}</Redirect>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  } else {
    // Last question, thank and hang up
    console.log('Survey completed. Thank you message sent.');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for completing our survey. Your feedback is valuable to us.</Say>
  <Hangup />
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  }
});

// Placeholder for next question handler
app.post('/api/twilio/next-question', (req, res) => {
  console.log('Next question handler called:', req.query);
  const questionNum = parseInt(req.query.question) || 1;
  const totalQuestions = parseInt(req.query.totalQuestions) || 1;
  const callSid = req.query.callSid;
  
  // Generate question text (in a real scenario, this would come from a database)
  const questionTexts = [
    "How satisfied are you with your healthcare provider on a scale from 1 to 5?",
    "How easy was it to schedule your last appointment on a scale from 1 to 5?",
    "Would you recommend your healthcare provider to friends or family?",
    "How helpful was the staff during your visit?"
  ];
  
  const questionText = questionTexts[(questionNum - 1) % questionTexts.length] || 
    `This would be question ${questionNum} of ${totalQuestions}.`;
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${questionNum}&amp;totalQuestions=${totalQuestions}&amp;callSid=${callSid}" method="POST">
    <Say>${questionText}</Say>
    <Say>Please answer after the tone.</Say>
  </Gather>
  <Say>I'm sorry, I didn't catch that. Let me ask again.</Say>
  <Gather input="dtmf speech" timeout="10" bargeIn="true" action="/api/twilio/response?question=${questionNum}&amp;totalQuestions=${totalQuestions}&amp;callSid=${callSid}" method="POST">
    <Say>${questionText}</Say>
    <Say>Please answer after the tone.</Say>
  </Gather>
</Response>`;
  res.type('text/xml');
  res.send(twiml);
});

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
});

// Start the server
app.listen(port, () => {
  console.log(`Audio server listening at http://localhost:${port}`);
  console.log(`Audio files served from: ${audioDir}`);
  console.log('To access audio files: http://localhost:3000/audio/filename.mp3');
}); 