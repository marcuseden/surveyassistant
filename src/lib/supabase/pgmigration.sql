-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS pgmigration(TEXT);

-- Create a function to run raw SQL for migrations
CREATE OR REPLACE FUNCTION pgmigration(query TEXT) 
RETURNS JSON AS $$
BEGIN
  EXECUTE query;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 