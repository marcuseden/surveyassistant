import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import type { CallQueue } from '@/lib/supabase/db';

// Get all call queue items
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const phoneListId = searchParams.get('phoneListId');
    const surveyId = searchParams.get('surveyId');
    
    let query = supabase
      .from('call_queue')
      .select('*, phone_list(name, phone_number), surveys(name)')
      .order('created_at', { ascending: false });
    
    // Apply filters if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    if (phoneListId) {
      query = query.eq('phone_list_id', phoneListId);
    }
    
    if (surveyId) {
      query = query.eq('survey_id', surveyId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching call queue:', error);
      return NextResponse.json({ error: 'Failed to fetch call queue' }, { status: 500 });
    }
    
    // Enhance data with total question counts
    const enhancedData = await Promise.all(data.map(async (item) => {
      // Count responses even if questions_answered column doesn't exist
      if (item.responses) {
        item.response_count = Object.keys(item.responses).length;
      } else {
        item.response_count = 0;
      }
      
      // Try to get total questions for this survey
      try {
        const { data: surveyQuestions, error: questionsError } = await supabase
          .from('survey_questions')
          .select('id')
          .eq('survey_id', item.survey_id);
          
        if (!questionsError && surveyQuestions) {
          item.total_questions = surveyQuestions.length;
        }
      } catch (e) {
        console.error('Error getting question count:', e);
      }
      
      return item;
    }));
    
    return NextResponse.json(enhancedData);
  } catch (error) {
    console.error('Unhandled error in call queue API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Add a new item to the call queue
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      phoneListId, 
      surveyId, 
      voiceOption, 
      languageOption, 
      scheduled = false,
      scheduledTime = null 
    } = body;
    
    if (!phoneListId) {
      return NextResponse.json(
        { error: 'Phone list ID is required' },
        { status: 400 }
      );
    }
    
    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      );
    }
    
    // Check if phone number exists
    const { data: phoneData, error: phoneError } = await supabase
      .from('phone_list')
      .select('phone_number')
      .eq('id', phoneListId)
      .single();
      
    if (phoneError || !phoneData) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }
    
    // Check if survey exists
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('name')
      .eq('id', surveyId)
      .single();
      
    if (surveyError || !surveyData) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }
    
    // Check if there's already an entry for this phone number and survey
    const { data: existingEntries, error: existingError } = await supabase
      .from('call_queue')
      .select('*')
      .eq('phone_list_id', phoneListId)
      .eq('survey_id', surveyId);
      
    if (existingError) {
      console.error('Error checking for existing call queue entries:', existingError);
      return NextResponse.json(
        { error: 'Failed to check for existing entries' },
        { status: 500 }
      );
    }
    
    // If an entry already exists, update it instead of creating a new one
    if (existingEntries && existingEntries.length > 0) {
      const existingEntry = existingEntries[0];
      console.log(`Found existing call queue entry: ${existingEntry.id}`);
      
      // Prepare update data
      const updateData: Partial<CallQueue> = {
        status: scheduled ? 'scheduled' : 'pending',
        voice_option: voiceOption,
        language_option: languageOption,
      };
      
      // If scheduled, set the next attempt time
      if (scheduled && scheduledTime) {
        updateData.next_attempt_at = scheduledTime;
      }
      
      const { data: updatedItem, error: updateError } = await supabase
        .from('call_queue')
        .update(updateData)
        .eq('id', existingEntry.id)
        .select('*, phone_list(name, phone_number), surveys(name)')
        .single();
        
      if (updateError) {
        console.error('Error updating call queue entry:', updateError);
        return NextResponse.json(
          { error: 'Failed to update call queue entry' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Call queue entry updated successfully',
        data: updatedItem,
        updated: true
      });
    }
    
    // Create the call queue item if no existing entry was found
    const queueItem: Partial<CallQueue> = {
      phone_list_id: phoneListId,
      survey_id: surveyId,
      status: scheduled ? 'scheduled' : 'pending',
      voice_option: voiceOption,
      language_option: languageOption,
      attempt_count: 0,
    };
    
    // If scheduled, set the next attempt time
    if (scheduled && scheduledTime) {
      queueItem.next_attempt_at = scheduledTime;
    }
    
    const { data: insertedItem, error: insertError } = await supabase
      .from('call_queue')
      .insert(queueItem)
      .select('*, phone_list(name, phone_number), surveys(name)')
      .single();
    
    if (insertError) {
      console.error('Error adding item to call queue:', insertError);
      return NextResponse.json(
        { error: 'Failed to add item to call queue' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Call added to queue successfully',
      data: insertedItem,
      created: true
    });
  } catch (error) {
    console.error('Unhandled error in call queue API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Update a call queue item
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, responses, callSid, callDuration, callStatus, errorMessage, notes } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Call queue ID is required' },
        { status: 400 }
      );
    }
    
    // Build the update object
    const updateData: Partial<CallQueue> = {};
    
    if (status) {
      updateData.status = status;
      
      // When marking as in-progress, increment attempt count and set last_attempt_at
      if (status === 'in-progress') {
        updateData.attempt_count = supabase.rpc('increment_counter', { row_id: id, table_name: 'call_queue', counter_name: 'attempt_count' });
        updateData.last_attempt_at = new Date().toISOString();
      }
    }
    
    if (callSid) updateData.call_sid = callSid;
    if (callDuration !== undefined) updateData.call_duration = callDuration;
    if (callStatus) updateData.call_status = callStatus;
    if (errorMessage) updateData.error_message = errorMessage;
    if (notes) updateData.notes = notes;
    if (responses) updateData.responses = responses;
    
    const { data, error } = await supabase
      .from('call_queue')
      .update(updateData)
      .eq('id', id)
      .select('*, phone_list(name, phone_number), surveys(name)')
      .single();
    
    if (error) {
      console.error('Error updating call queue item:', error);
      return NextResponse.json(
        { error: 'Failed to update call queue item' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Call queue item updated successfully',
      data
    });
  } catch (error) {
    console.error('Unhandled error in call queue API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 