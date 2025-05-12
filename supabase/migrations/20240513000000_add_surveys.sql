-- Create surveys table
CREATE TABLE IF NOT EXISTS public.surveys (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint on survey name
ALTER TABLE public.surveys ADD CONSTRAINT surveys_name_key UNIQUE (name);

-- Create survey_questions table for mapping questions to surveys
CREATE TABLE IF NOT EXISTS public.survey_questions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id uuid REFERENCES public.surveys(id) ON DELETE CASCADE,
    question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a unique constraint to prevent duplicate questions in a survey
CREATE UNIQUE INDEX IF NOT EXISTS survey_questions_unique_idx 
ON public.survey_questions (survey_id, question_id);

-- Update the questions table to include follow-up functionality if it doesn't exist
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS is_follow_up BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL;

-- Add RLS policies for surveys
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to surveys" ON public.surveys FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert surveys" ON public.surveys FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update their surveys" ON public.surveys FOR UPDATE USING (true);

-- Add RLS policies for survey_questions
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to survey questions" ON public.survey_questions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert survey questions" ON public.survey_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update survey questions" ON public.survey_questions FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete survey questions" ON public.survey_questions FOR DELETE USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_surveys_timestamp 
BEFORE UPDATE ON public.surveys
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_survey_questions_timestamp 
BEFORE UPDATE ON public.survey_questions
FOR EACH ROW EXECUTE PROCEDURE update_timestamp(); 