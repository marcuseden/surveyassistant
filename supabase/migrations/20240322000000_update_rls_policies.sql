-- Update RLS policies to allow insert operations
CREATE POLICY "Enable insert for anonymous users" ON phone_list
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for anonymous users" ON questions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for anonymous users" ON responses
    FOR INSERT WITH CHECK (true);

-- Also add update policies
CREATE POLICY "Enable update for all users" ON phone_list
    FOR UPDATE USING (true);

CREATE POLICY "Enable update for all users" ON questions
    FOR UPDATE USING (true);

CREATE POLICY "Enable update for all users" ON responses
    FOR UPDATE USING (true);

-- Also add delete policies
CREATE POLICY "Enable delete for all users" ON phone_list
    FOR DELETE USING (true);

CREATE POLICY "Enable delete for all users" ON questions
    FOR DELETE USING (true);

CREATE POLICY "Enable delete for all users" ON responses
    FOR DELETE USING (true); 