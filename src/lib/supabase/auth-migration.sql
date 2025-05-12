-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure tables reference users instead of arbitrary phone list
ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Create triggers to automatically update updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

-- Add trigger for users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
    
-- Add policies for row-level security
-- First enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY user_select_own 
  ON users FOR SELECT 
  USING (id = auth.uid());

CREATE POLICY user_update_own 
  ON users FOR UPDATE 
  USING (id = auth.uid());

-- Admins can manage all users
CREATE POLICY admin_manage_users 
  ON users 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create policies for surveys (admin-only)
CREATE POLICY admin_manage_surveys 
  ON surveys 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create policies for questions (admin-only)
CREATE POLICY admin_manage_questions 
  ON questions 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Everyone can view questions and surveys
CREATE POLICY all_view_questions 
  ON questions FOR SELECT 
  USING (true);

CREATE POLICY all_view_surveys 
  ON surveys FOR SELECT 
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_responses_user ON responses(user_id); 