-- SQL script to add the key_insights column to the responses table
-- Run this in the Supabase SQL Editor

-- First check if the column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'responses' AND column_name = 'key_insights'
    ) THEN
        -- Add the key_insights column if it doesn't exist
        ALTER TABLE responses ADD COLUMN key_insights TEXT;
        
        -- Add a comment to describe the column
        COMMENT ON COLUMN responses.key_insights IS 'AI-generated insights extracted from survey responses';
    END IF;
END $$; 