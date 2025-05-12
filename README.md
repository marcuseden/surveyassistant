# AI Research Assistant

A full-stack application for conducting automated phone surveys with AI-powered follow-up questions.

## Features

- Automated phone calls using Twilio
- Voice recording and transcription
- AI-generated follow-up questions using OpenAI
- Real-time response statistics with Chart.js
- Modern UI with Tailwind CSS
- Secure data storage with Supabase
- Serverless deployment on Vercel

## Tech Stack

- Next.js 14 (App Router)
- Supabase (PostgreSQL)
- Twilio (Voice Calls)
- OpenAI (GPT-4)
- Chart.js
- Tailwind CSS
- Vercel (Deployment)

## Prerequisites

- Node.js 18+ and npm
- Supabase account
- Twilio account
- OpenAI API key
- Vercel account

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Vercel Configuration
VERCEL_URL=your_vercel_deployment_url
```

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ai-research-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL migrations in `supabase/migrations/20240321000000_initial_schema.sql`
   - Copy the project URL and anon key to your `.env.local` file

4. Set up Twilio:
   - Create a Twilio account
   - Get a phone number
   - Copy the account SID, auth token, and phone number to your `.env.local` file

5. Set up OpenAI:
   - Create an OpenAI account
   - Generate an API key
   - Copy the API key to your `.env.local` file

6. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment

1. Push your code to GitHub

2. Connect your repository to Vercel:
   - Create a new project in Vercel
   - Import your GitHub repository
   - Configure the environment variables
   - Deploy

3. Configure Twilio webhook:
   - Set the webhook URL to `https://your-vercel-url/api/twilio/transcription`
   - Configure the webhook to handle POST requests

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── twilio/
│   │       └── transcription/
│   │           └── route.ts
│   └── page.tsx
├── components/
├── lib/
│   ├── charts/
│   │   └── utils.ts
│   ├── openai/
│   │   └── utils.ts
│   ├── supabase/
│   │   └── client.ts
│   └── twilio/
│       └── utils.ts
└── supabase/
    └── migrations/
        └── 20240321000000_initial_schema.sql
```

## Usage

1. Add phone numbers to the phone list
2. Add initial questions
3. The system will automatically:
   - Make calls to phone numbers
   - Play questions using text-to-speech
   - Record and transcribe responses
   - Generate follow-up questions
   - Display response statistics

## Security

- Row Level Security (RLS) is enabled on all Supabase tables
- Environment variables are used for sensitive credentials
- API routes are protected with proper error handling
- Input validation is implemented throughout the application

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License
