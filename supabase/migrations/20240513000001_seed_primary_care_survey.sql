-- Create the Primary Care Survey
INSERT INTO public.surveys (name, description)
VALUES (
    'Primary Care Access Survey',
    'A comprehensive survey about primary care access, barriers, and impacts on health and quality of life'
) ON CONFLICT (name) DO NOTHING;

-- Create questions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'questions') THEN
        CREATE TABLE public.questions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            question_text TEXT NOT NULL,
            is_follow_up BOOLEAN DEFAULT false,
            parent_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
    END IF;
END
$$;

-- Get the survey ID
DO $$
DECLARE
    survey_id uuid;
    question_id uuid;
    question_order int := 1;
BEGIN
    -- Get the survey ID
    SELECT id INTO survey_id FROM public.surveys WHERE name = 'Primary Care Access Survey' LIMIT 1;
    
    -- Insert the questions and add them to the survey
    
    -- Question 1
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('Do you have a primary care doctor you see regularly? Please say ''Yes,'' ''No,'' or ''I don''t know.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 2
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('How do you usually contact your primary care doctor? Please say one: ''Phone,'' ''Online,'' ''In-person,'' ''Email,'' or ''Other.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 3
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('How do you schedule appointments with your doctor? Please say one: ''Call the office,'' ''Online,'' ''Walk-in,'' or ''Other.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 4
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('How long does it usually take to get an appointment? Please say one: ''Same day,'' ''1 to 3 days,'' ''1 to 2 weeks,'' ''1 month or more,'' or ''I can''t get one.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 5
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('Have you used telehealth to connect with a doctor in the past year? Please say ''Yes'' or ''No.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 6
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('Have you ever had trouble contacting or seeing a primary care doctor? Please say ''Yes'' or ''No.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 7
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('What is the biggest barrier to accessing primary care for you? Please describe in a few words.', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 8
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('Have you ever avoided seeking primary care because of these challenges? Please say ''Yes'' or ''No.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 9
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('How have challenges accessing primary care affected your health? Please say one: ''No impact,'' ''Minor impact,'' ''Moderate impact,'' or ''Severe impact.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 10
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('Have access issues ever caused you to miss work or hurt your job performance? Please say ''Yes'' or ''No.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 11
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('How have these challenges impacted your quality of life? Please say one: ''No impact,'' ''Minor impact,'' ''Moderate impact,'' or ''Severe impact.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 12
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('Have you or a family member had a serious health issue due to delayed or no primary care? Please say ''Yes'' or ''No.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 13
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('What is your age group? Please say one: ''18 to 24,'' ''25 to 34,'' ''35 to 44,'' ''45 to 54,'' ''55 to 64,'' or ''65 and older.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 14
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('What is your insurance status? Please say one: ''Private insurance,'' ''Medicare,'' ''Medicaid,'' ''Uninsured,'' or ''Other.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 15
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('Where do you live? Please say one: ''Urban,'' ''Suburban,'' or ''Rural.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    question_order := question_order + 1;
    
    -- Question 16
    INSERT INTO public.questions (question_text, is_follow_up, parent_question_id)
    VALUES ('What is your household income? Please say one: ''Under 25,000,'' ''25,000 to 50,000,'' ''50,000 to 100,000,'' ''Over 100,000,'' or ''Prefer not to say.''', false, null)
    RETURNING id INTO question_id;
    
    INSERT INTO public.survey_questions (survey_id, question_id, "order")
    VALUES (survey_id, question_id, question_order);
    
END $$; 