import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/db';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    
    // Try to sign in
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Login error:', error);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json({
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Unexpected error during login:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 