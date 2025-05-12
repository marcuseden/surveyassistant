import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/db';
import { supabase } from '@/lib/supabase/client';
import { USE_MOCK_DB } from '@/lib/db-config';

export async function GET() {
  try {
    // Report configuration
    const config = {
      useMockDb: USE_MOCK_DB,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKeyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKeyPresent: !!process.env.SUPABASE_SERVICE_KEY,
    };
    
    // Test db client
    let dbClientData = null;
    let dbClientError = null;
    try {
      const { data, error } = await db
        .from('phone_list')
        .select('*')
        .limit(1);
      
      dbClientData = data;
      dbClientError = error;
    } catch (error) {
      dbClientError = { message: 'Exception occurred', details: error instanceof Error ? error.message : String(error) };
    }
    
    // Test supabase client
    let supabaseClientData = null;
    let supabaseClientError = null;
    try {
      const { data, error } = await supabase
        .from('phone_list')
        .select('*')
        .limit(1);
      
      supabaseClientData = data;
      supabaseClientError = error;
    } catch (error) {
      supabaseClientError = { message: 'Exception occurred', details: error instanceof Error ? error.message : String(error) };
    }
    
    // Test auth
    let authSession = null;
    let authError = null;
    try {
      const { data, error } = await db.auth.getSession();
      authSession = data;
      authError = error;
    } catch (error) {
      authError = { message: 'Exception occurred', details: error instanceof Error ? error.message : String(error) };
    }
    
    return NextResponse.json({
      config,
      dbClient: {
        data: dbClientData,
        error: dbClientError
      },
      supabaseClient: {
        data: supabaseClientData,
        error: supabaseClientError
      },
      auth: {
        session: authSession,
        error: authError
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unexpected error occurred', details: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
} 