import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/db';

const samplePhoneNumbers = [
  { name: "John Doe", phone_number: "+16505551234" },
  { name: "Jane Smith", phone_number: "+14155557890" },
  { name: "Robert Johnson", phone_number: "+12125559876" }
];

// GET endpoint to retrieve all phone numbers
export async function GET() {
  try {
    const { data, error } = await db
      .from('phone_list')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ phoneNumbers: data });
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 });
  }
}

// POST endpoint to add a phone number
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone_number } = body;

    if (!name || !phone_number) {
      return NextResponse.json(
        { error: 'Name and phone number are required' },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from('phone_list')
      .insert({ name, phone_number })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ phoneNumber: data });
  } catch (error) {
    console.error('Error adding phone number:', error);
    return NextResponse.json({ error: 'Failed to add phone number' }, { status: 500 });
  }
}

// PUT endpoint to populate sample phone numbers if none exist
export async function PUT() {
  try {
    // Check if there are existing phone numbers
    const { data: existingNumbers, error: checkError } = await db
      .from('phone_list')
      .select('id')
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    // If there are already phone numbers, return them
    if (existingNumbers && existingNumbers.length > 0) {
      const { data, error } = await db
        .from('phone_list')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ 
        message: 'Phone numbers already exist',
        phoneNumbers: data 
      });
    }

    // No phone numbers exist, add sample phone numbers
    const { data, error } = await db
      .from('phone_list')
      .insert(samplePhoneNumbers)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: 'Added sample phone numbers',
      phoneNumbers: data
    });
  } catch (error) {
    console.error('Error populating sample phone numbers:', error);
    return NextResponse.json({ error: 'Failed to populate sample phone numbers' }, { status: 500 });
  }
} 