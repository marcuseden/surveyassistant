# Database Setup for AI Research Assistant

This project uses Supabase as the database provider. Below are instructions on how to set up the database and run migrations.

## Prerequisites

1. A Supabase account with a project created
2. Access to your Supabase project's API keys (URL and keys)

## Environment Variables

Add the following environment variables to your `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The `SUPABASE_SERVICE_ROLE_KEY` is used only for migrations and should be kept secure.

## Database Schema

The database consists of the following tables:

1. `phone_list` - Stores contact information for survey participants
2. `questions` - Contains all questions that can be used in surveys
3. `surveys` - Defines survey metadata (name, description)
4. `survey_questions` - Maps questions to surveys with ordering information
5. `responses` - Stores the responses to survey questions

## Setting Up the Database

### 1. Set up the pgmigration function in Supabase

Before running migrations, you need to create a function in your Supabase project that allows executing SQL:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy and paste the contents of `src/lib/supabase/pgmigration.sql`
5. Run the query to create the function

### 2. Run Migrations

After creating the function and setting up your environment variables, run:

```bash
npm run migrate
```

This will create all necessary tables and indexes in your Supabase database.

## Development

After running the migrations, you can start the development server:

```bash
npm run dev
```

The application now uses the real Supabase database instead of mock data. 