-- Create tables for the AI research assistant
CREATE TABLE phone_list (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_text TEXT NOT NULL,
    is_follow_up BOOLEAN DEFAULT false,
    parent_question_id UUID REFERENCES questions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_list_id UUID REFERENCES phone_list(id) NOT NULL,
    question_id UUID REFERENCES questions(id) NOT NULL,
    answer_text TEXT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE phone_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON phone_list
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON questions
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON responses
    FOR SELECT USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_phone_list_phone_number ON phone_list(phone_number);
CREATE INDEX idx_responses_phone_list_id ON responses(phone_list_id);
CREATE INDEX idx_responses_question_id ON responses(question_id);
CREATE INDEX idx_questions_parent_question_id ON questions(parent_question_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_phone_list_updated_at
    BEFORE UPDATE ON phone_list
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 