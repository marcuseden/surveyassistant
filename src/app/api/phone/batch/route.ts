import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

// Types for the payload
interface PhoneEntry {
  name: string;
  phone_number: string;
}

interface BatchRequest {
  phoneEntries: PhoneEntry[];
}

// POST endpoint to add multiple phone numbers at once
export async function POST(request: Request) {
  try {
    const body: BatchRequest = await request.json();
    const { phoneEntries } = body;

    if (!phoneEntries || !Array.isArray(phoneEntries) || phoneEntries.length === 0) {
      return NextResponse.json(
        { error: 'Phone entries are required and must be an array' },
        { status: 400 }
      );
    }

    // Validate all phone entries
    const validEntries = phoneEntries.filter(entry => {
      if (!entry.name || !entry.phone_number) return false;
      
      // Basic E.164 validation
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      return phoneRegex.test(entry.phone_number);
    });

    if (validEntries.length === 0) {
      return NextResponse.json(
        { error: 'No valid phone entries found' },
        { status: 400 }
      );
    }

    // Insert all valid entries
    const { data, error } = await supabase
      .from('phone_list')
      .insert(validEntries)
      .select();

    if (error) {
      console.error('Error adding phone numbers in batch:', error);
      throw error;
    }

    // Fetch the full list after inserting to ensure we have the most up-to-date data
    const { data: updatedList, error: listError } = await supabase
      .from('phone_list')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (listError) {
      console.error('Error fetching updated phone list:', listError);
    }

    return NextResponse.json({
      message: 'Phone numbers added successfully',
      count: data?.length || validEntries.length,
      phoneNumbers: data,
      fullList: updatedList || []
    });
  } catch (error) {
    console.error('Error processing batch phone numbers upload:', error);
    return NextResponse.json(
      { error: 'Failed to process phone numbers' },
      { status: 500 }
    );
  }
} 