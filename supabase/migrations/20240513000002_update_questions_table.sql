-- Update questions table if it exists but doesn't have required columns
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'questions') THEN
        -- Add is_follow_up column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'questions' 
                       AND column_name = 'is_follow_up') THEN
            ALTER TABLE public.questions ADD COLUMN is_follow_up BOOLEAN DEFAULT false;
        END IF;
        
        -- Add parent_question_id column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'questions' 
                       AND column_name = 'parent_question_id') THEN
            ALTER TABLE public.questions ADD COLUMN parent_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL;
        END IF;
    ELSE
        -- Create questions table if it doesn't exist
        CREATE TABLE public.questions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            question_text TEXT NOT NULL,
            is_follow_up BOOLEAN DEFAULT false,
            parent_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
        
        -- Enable row level security
        ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow public access to questions" ON public.questions FOR SELECT USING (true);
        CREATE POLICY "Allow authenticated users to insert questions" ON public.questions FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow authenticated users to update questions" ON public.questions FOR UPDATE USING (true);
    END IF;
END
$$; 