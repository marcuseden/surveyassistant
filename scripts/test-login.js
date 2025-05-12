require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function testLogin() {
  try {
    console.log('Testing login API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'm_lowegren@mac.com',
        password: 'ABC123'
      }),
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('Login successful!');
    } else {
      console.log('Login failed.');
    }
  } catch (error) {
    console.error('Error testing login API:', error);
  }
}

testLogin(); 