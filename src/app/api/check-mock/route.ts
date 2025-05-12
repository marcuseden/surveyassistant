import { NextResponse } from 'next/server';
import { USE_MOCK_DB } from '@/lib/db-config';

export async function GET() {
  return NextResponse.json({
    useMockDb: USE_MOCK_DB,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKeyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKeyPresent: !!process.env.SUPABASE_SERVICE_KEY,
  });
} 