// Configuration setting to force using real database
// Set this to false to always use the real Supabase database
// If the FORCE_REAL_DB environment variable is set to 'true', we'll always use the real database
export const USE_MOCK_DB = process.env.FORCE_REAL_DB === 'true' ? 
  false : 
  false; // Second value is the default, already false in our case

// Set this to false to use the real OpenAI API
export const USE_MOCK_OPENAI = process.env.FORCE_REAL_DB === 'true' ? 
  false :
  false; // Second value is the default, already false in our case 