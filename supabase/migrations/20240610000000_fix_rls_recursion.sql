-- Fix infinite recursion in users RLS policy

-- First drop the problematic policy
DROP POLICY IF EXISTS admin_manage_users ON users;

-- Create a better admin policy that doesn't cause recursion
-- This uses auth.jwt() to check the role claim directly instead of querying the users table
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- First check if the user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the user has admin role in the auth metadata
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      raw_user_meta_data->>'role' = 'admin' OR 
      raw_app_meta_data->>'role' = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a more efficient admin policy for users table
CREATE POLICY admin_manage_users_select 
  ON users FOR SELECT 
  USING (
    is_admin() OR id = auth.uid()
  );

CREATE POLICY admin_manage_users_insert 
  ON users FOR INSERT 
  WITH CHECK (
    is_admin()
  );

CREATE POLICY admin_manage_users_update 
  ON users FOR UPDATE 
  USING (
    is_admin() OR id = auth.uid()
  );

CREATE POLICY admin_manage_users_delete 
  ON users FOR DELETE 
  USING (
    is_admin()
  );

-- Also fix the admin policies for other tables
DROP POLICY IF EXISTS admin_manage_surveys ON surveys;
DROP POLICY IF EXISTS admin_manage_questions ON questions;

CREATE POLICY admin_manage_surveys 
  ON surveys 
  USING (
    is_admin()
  );

CREATE POLICY admin_manage_questions 
  ON questions 
  USING (
    is_admin()
  ); 