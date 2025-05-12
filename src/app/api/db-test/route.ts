import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/db';

export async function GET() {
  try {
    // Check database connection
    const { data, error } = await db
      .from('phone_list')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('Database connection error:', error);
      return NextResponse.json(
        { error: 'Failed to connect to database', details: error.message }, 
        { status: 500 }
      );
    }
    
    // Check tables exist by querying each
    const tablesStatus = await checkTables();
    
    return NextResponse.json({
      status: 'Database connection successful',
      phoneCount: data,
      tables: tablesStatus
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error occurred', details: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
}

async function checkTables() {
  const tables = ['phone_list', 'questions', 'surveys', 'survey_questions', 'responses'];
  const status: { [key: string]: string } = {};
  
  for (const table of tables) {
    try {
      const { error } = await db
        .from(table)
        .select('count(*)', { count: 'exact', head: true });
      
      status[table] = error ? 'Error: ' + error.message : 'OK';
    } catch (error) {
      status[table] = 'Error: ' + (error instanceof Error ? error.message : String(error));
    }
  }
  
  return status;
} 