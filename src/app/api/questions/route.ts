import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/db';

const sampleQuestions = [
  { question_text: "Do you have a primary care doctor you see regularly? Please say 'Yes,' 'No,' or 'I don't know.'" },
  { question_text: "How do you usually contact your primary care doctor? Please say one: 'Phone,' 'Online,' 'In-person,' 'Email,' or 'Other.'" },
  { question_text: "How do you schedule appointments with your doctor? Please say one: 'Call the office,' 'Online,' 'Walk-in,' or 'Other.'" },
  { question_text: "How long does it usually take to get an appointment? Please say one: 'Same day,' '1 to 3 days,' '1 to 2 weeks,' '1 month or more,' or 'I can't get one.'" },
  { question_text: "Have you used telehealth to connect with a doctor in the past year? Please say 'Yes' or 'No.'" },
  { question_text: "Have you ever had trouble contacting or seeing a primary care doctor? Please say 'Yes' or 'No.'" },
  { question_text: "What is the biggest barrier to accessing primary care for you? Please describe in a few words." },
  { question_text: "Have you ever avoided seeking primary care because of these challenges? Please say 'Yes' or 'No.'" },
  { question_text: "How have challenges accessing primary care affected your health? Please say one: 'No impact,' 'Minor impact,' 'Moderate impact,' or 'Severe impact.'" },
  { question_text: "Have access issues ever caused you to miss work or hurt your job performance? Please say 'Yes' or 'No.'" },
  { question_text: "How have these challenges impacted your quality of life? Please say one: 'No impact,' 'Minor impact,' 'Moderate impact,' or 'Severe impact.'" },
  { question_text: "Have you or a family member had a serious health issue due to delayed or no primary care? Please say 'Yes' or 'No.'" },
  { question_text: "What is your age group? Please say one: '18 to 24,' '25 to 34,' '35 to 44,' '45 to 54,' '55 to 64,' or '65 and older.'" },
  { question_text: "What is your insurance status? Please say one: 'Private insurance,' 'Medicare,' 'Medicaid,' 'Uninsured,' or 'Other.'" },
  { question_text: "Where do you live? Please say one: 'Urban,' 'Suburban,' or 'Rural.'" },
  { question_text: "What is your household income? Please say one: 'Under 25,000,' '25,000 to 50,000,' '50,000 to 100,000,' 'Over 100,000,' or 'Prefer not to say.'" },
];

// GET endpoint to retrieve all questions
export async function GET() {
  try {
    const { data, error } = await db
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ questions: data });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// POST endpoint to add a question
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question_text, is_follow_up, parent_question_id } = body;

    if (!question_text) {
      return NextResponse.json(
        { error: 'Question text is required' },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from('questions')
      .insert({ 
        question_text, 
        is_follow_up: is_follow_up || false, 
        parent_question_id: parent_question_id || null 
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ question: data });
  } catch (error) {
    console.error('Error adding question:', error);
    return NextResponse.json({ error: 'Failed to add question' }, { status: 500 });
  }
}

// PUT endpoint to populate sample questions if none exist
export async function PUT() {
  try {
    // Check if there are existing questions
    const { data: existingQuestions, error: checkError } = await db
      .from('questions')
      .select('id')
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    // If there are already questions, return them
    if (existingQuestions && existingQuestions.length > 0) {
      const { data, error } = await db
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ 
        message: 'Questions already exist',
        questions: data 
      });
    }

    // Save the current phone data to ensure it doesn't get wiped
    // This is mainly needed for our mock database implementation
    const { data: phoneData } = await db
      .from('phone_list')
      .select('*');
      
    // No questions exist, add sample questions
    const { data, error } = await db
      .from('questions')
      .insert(sampleQuestions)
      .select();

    if (error) {
      throw error;
    }
    
    // Also check to ensure phone list is still intact
    const { data: newPhoneList } = await db
      .from('phone_list')
      .select('*');
    
    return NextResponse.json({
      message: 'Added sample questions',
      questions: data,
      phoneList: newPhoneList
    });
  } catch (error) {
    console.error('Error populating sample questions:', error);
    return NextResponse.json({ error: 'Failed to populate sample questions' }, { status: 500 });
  }
} 