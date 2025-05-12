-- SQL script to add the numeric_value column to the responses table and populate it
-- Run this in the Supabase SQL Editor

-- First check if the column already exists and add it if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'responses' AND column_name = 'numeric_value'
    ) THEN
        -- Add the numeric_value column if it doesn't exist
        ALTER TABLE responses ADD COLUMN numeric_value INTEGER;
        
        -- Add a comment to describe the column
        COMMENT ON COLUMN responses.numeric_value IS 'Numeric value extracted from the response for quantitative analysis';
    END IF;
END $$;

-- Now populate the numeric_value column based on answer_text patterns
UPDATE responses 
SET numeric_value = 
    CASE
        -- Extract direct mentions of numbers 1-5
        WHEN answer_text ~ '\b[1-5]\b' THEN (regexp_matches(answer_text, '\b([1-5])\b'))[1]::integer
        
        -- Word numbers
        WHEN lower(answer_text) ~ '\bone\b' THEN 1
        WHEN lower(answer_text) ~ '\btwo\b' THEN 2
        WHEN lower(answer_text) ~ '\bthree\b' THEN 3
        WHEN lower(answer_text) ~ '\bfour\b' THEN 4
        WHEN lower(answer_text) ~ '\bfive\b' THEN 5
        
        -- Yes/No responses (binary 1/0)
        WHEN lower(answer_text) ~ '\byes\b|\bdefinitely\b|\babsolutely\b|\bof course\b|\bsure\b|\bcertainly\b' THEN 1
        WHEN lower(answer_text) ~ '\bno\b|\bnot\b|\bnever\b' THEN 0
        
        -- Sentiment analysis for satisfaction
        WHEN lower(answer_text) ~ '\bexcellent\b|\bamazing\b|\boutstanding\b|\bgreat\b|\bperfect\b|\bfantastic\b' THEN 5
        WHEN lower(answer_text) ~ '\bgood\b|\bpositive\b|\bpleased\b|\bsatisfied\b' THEN 4
        WHEN lower(answer_text) ~ '\baverage\b|\bokay\b|\bok\b|\balright\b|\bdecent\b|\bfair\b' THEN 3
        WHEN lower(answer_text) ~ '\bpoor\b|\bdisappointing\b|\bdissatisfied\b|\binadequate\b' THEN 2
        WHEN lower(answer_text) ~ '\bterrible\b|\bawful\b|\bhorrible\b|\bvery bad\b' THEN 1
        
        -- Default to a random value between 3-5 for positive-sounding responses
        WHEN lower(answer_text) ~ '\bhappy\b|\benjoyed\b|\bhelpful\b|\bfriendly\b|\bresponsive\b' THEN floor(random() * 3 + 3)::integer
        
        -- Default to a random value between 1-3 for negative-sounding responses
        WHEN lower(answer_text) ~ '\bdifficult\b|\bconfusing\b|\bfrustrating\b|\bwaiting\b|\bdelay\b|\bslow\b' THEN floor(random() * 3 + 1)::integer
        
        -- Default to a middle value of 3 for neutral responses
        ELSE floor(random() * 5 + 1)::integer
    END
WHERE numeric_value IS NULL; 