'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { hasPermission } from '@/lib/rbac';
import { logEventCreated, logEventUpdated, logEventDeleted } from '@/lib/activity-logger';
import NepaliDate from 'nepali-date-converter';
import type { CalendarEvent, EventWithDetails } from '@/lib/types';

// =============================================
// Nepali Date Helpers for Recurring Expansion
// =============================================

/** Get number of days in a Nepali month */
function getDaysInNepaliMonth(year: number, month: number): number {
  try {
    for (let day = 32; day >= 29; day--) {
      try {
        new NepaliDate(year, month, day);
        return day;
      } catch {
        continue;
      }
    }
    return 30;
  } catch {
    return 30;
  }
}

/** Parse "YYYY-MM-DD" to { year, month, day } (month is 0-indexed) */
function parseBsDate(bs: string): { year: number; month: number; day: number } {
  const [y, m, d] = bs.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

/** Format { year, month(0-indexed), day } to "YYYY-MM-DD" */
function formatBsDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Advance a BS date by a given frequency
 * Returns null if the resulting date is invalid
 */
function advanceBsDate(
  year: number,
  month: number,
  day: number,
  frequency: string,
  steps: number
): { year: number; month: number; day: number } | null {
  try {
    if (frequency === 'daily') {
      // Convert to JS date, add days, convert back
      const jsDate = new NepaliDate(year, month, day).toJsDate();
      jsDate.setDate(jsDate.getDate() + steps);
      const nd = new NepaliDate(jsDate);
      return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
    }
    if (frequency === 'weekly') {
      const jsDate = new NepaliDate(year, month, day).toJsDate();
      jsDate.setDate(jsDate.getDate() + steps * 7);
      const nd = new NepaliDate(jsDate);
      return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
    }
    if (frequency === 'monthly') {
      let newMonth = month + steps;
      let newYear = year;
      while (newMonth > 11) { newMonth -= 12; newYear++; }
      while (newMonth < 0) { newMonth += 12; newYear--; }
      const maxDay = getDaysInNepaliMonth(newYear, newMonth);
      const newDay = Math.min(day, maxDay);
      // Validate
      new NepaliDate(newYear, newMonth, newDay);
      return { year: newYear, month: newMonth, day: newDay };
    }
    if (frequency === 'yearly') {
      const newYear = year + steps;
      const maxDay = getDaysInNepaliMonth(newYear, month);
      const newDay = Math.min(day, maxDay);
      new NepaliDate(newYear, month, newDay);
      return { year: newYear, month: month, day: newDay };
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================
// Event Queries
// =============================================

/**
 * Get all events (including recurring expansions and birthdays) for a Nepali month
 */
export async function getEventsForMonth(
  viewYear: number,
  viewMonth: number // 0-indexed
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const result: CalendarEvent[] = [];
  const monthStr = String(viewMonth + 1).padStart(2, '0');

  // 1. Fetch one-off events for this exact month
  const { data: directEvents } = await supabase
    .from('events')
    .select('*, subscribers!inner(id, full_name, master_id, phone, email)')
    .like('event_date', `${viewYear}-${monthStr}-%`)
    .is('recurring_frequency', null);

  for (const ev of directEvents || []) {
    result.push({
      id: ev.id,
      event_name: ev.event_name,
      event_date: ev.event_date,
      event_time: ev.event_time,
      subscriber_name: ev.subscribers.full_name,
      subscriber_id: ev.subscriber_id,
      is_birthday: false,
      is_recurring: false,
      notes: ev.notes,
      referred_by: ev.referred_by || null,
      form_number: ev.form_number || null,
    });
  }

  // 2. Fetch all recurring events (could start in any month)
  const { data: recurringEvents } = await supabase
    .from('events')
    .select('*, subscribers!inner(id, full_name, master_id, phone, email)')
    .not('recurring_frequency', 'is', null);

  for (const ev of recurringEvents || []) {
    const base = parseBsDate(ev.event_date);
    const freq = ev.recurring_frequency!;
    const isIndefinite = ev.recurring_indefinite;
    const maxCount = ev.recurring_count || 1000; // cap to prevent infinite loops

    // Check each occurrence to see if it falls in viewYear/viewMonth
    for (let i = 0; i <= (isIndefinite ? 2000 : maxCount); i++) {
      const occ = advanceBsDate(base.year, base.month, base.day, freq, i);
      if (!occ) continue;

      // If we've gone past the target year+month and frequency isn't daily/weekly, break early
      if (freq === 'monthly' || freq === 'yearly') {
        if (occ.year > viewYear || (occ.year === viewYear && occ.month > viewMonth)) break;
      }
      if (freq === 'daily' || freq === 'weekly') {
        // For daily/weekly, break if we've gone well past the target month
        if (occ.year > viewYear + 1) break;
        if (occ.year > viewYear && occ.month > viewMonth) break;
      }

      if (occ.year === viewYear && occ.month === viewMonth) {
        result.push({
          id: `${ev.id}_${i}`,
          event_name: ev.event_name,
          event_date: formatBsDate(occ.year, occ.month, occ.day),
          event_time: ev.event_time,
          subscriber_name: ev.subscribers.full_name,
          subscriber_id: ev.subscriber_id,
          is_birthday: false,
          is_recurring: true,
          source_event_id: ev.id,
          notes: ev.notes,
          referred_by: ev.referred_by || null,
          form_number: ev.form_number || null,
        });
      }
    }
  }

  // 3. Fetch birthdays: subscribers with date_of_birth_bs matching month
  const { data: birthdaySubs } = await adminSupabase
    .from('subscribers')
    .select('id, full_name, date_of_birth_bs')
    .not('date_of_birth_bs', 'is', null);

  for (const sub of birthdaySubs || []) {
    if (!sub.date_of_birth_bs) continue;
    const dob = parseBsDate(sub.date_of_birth_bs);
    if (dob.month === viewMonth) {
      // Place birthday on the same day in viewYear
      const maxDay = getDaysInNepaliMonth(viewYear, viewMonth);
      const day = Math.min(dob.day, maxDay);
      result.push({
        id: `birthday_${sub.id}`,
        event_name: `🎂 ${sub.full_name}'s Birthday`,
        event_date: formatBsDate(viewYear, viewMonth, day),
        event_time: null,
        subscriber_name: sub.full_name,
        subscriber_id: sub.id,
        is_birthday: true,
        is_recurring: false,
        notes: null,
        referred_by: null,
        form_number: null,
      });
    }
  }

  return result;
}

/**
 * Get a single event by ID (for detail view / editing)
 */
export async function getEventById(eventId: string): Promise<EventWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('events')
    .select('*, subscribers!inner(id, full_name, master_id, phone, email)')
    .eq('id', eventId)
    .single();

  if (error || !data) return null;
  return data as EventWithDetails;
}

/**
 * Get events for the list view with pagination and search
 */
export async function getEventsForList(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ events: EventWithDetails[]; total: number }> {
  const supabase = await createClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('events')
    .select('*, subscribers!inner(id, full_name, master_id, phone, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    
    // First, find any subscribers that match the search term
    const adminSupabase = createAdminClient();
    const { data: matchingSubs } = await adminSupabase
      .from('subscribers')
      .select('id')
      .or(`full_name.ilike.%${s}%,master_id.ilike.%${s}%`);
      
    const matchingSubscriberIds = (matchingSubs || []).map(sub => sub.id);

    // Build the OR parts for the events table
    const orParts: string[] = [
      `event_name.ilike.%${s}%`,
      `referred_by.ilike.%${s}%`,
      `form_number.ilike.%${s}%`
    ];

    if (matchingSubscriberIds.length > 0) {
      orParts.push(`subscriber_id.in.(${matchingSubscriberIds.join(',')})`);
    }

    query = query.or(orParts.join(','));
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching events for list:', error);
    return { events: [], total: 0 };
  }

  return {
    events: (data || []) as EventWithDetails[],
    total: count || 0,
  };
}

// =============================================
// Event CRUD
// =============================================

/**
 * Create a new event
 */
export async function createEvent(data: {
  subscriber_id: string;
  event_name: string;
  event_date: string; // BS date "YYYY-MM-DD"
  event_time?: string;
  recurring_frequency?: string;
  recurring_count?: number;
  recurring_indefinite?: boolean;
  notes?: string;
  referred_by?: string;
  form_number?: string;
}): Promise<{ success: boolean; message: string }> {
  const canCreate = await hasPermission('CREATE_EVENT');
  if (!canCreate) {
    return { success: false, message: 'Unauthorized: You do not have permission to create events' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Not authenticated' };

  const adminSupabase = createAdminClient();

  try {
    const { data: inserted, error } = await adminSupabase
      .from('events')
      .insert({
        subscriber_id: data.subscriber_id,
        event_name: data.event_name,
        event_date: data.event_date,
        event_time: data.event_time || null,
        recurring_frequency: data.recurring_frequency || null,
        recurring_count: data.recurring_count || null,
        recurring_indefinite: data.recurring_indefinite || false,
        notes: data.notes || null,
        referred_by: data.referred_by || null,
        form_number: data.form_number || null,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Get subscriber name for logging
    const { data: subData } = await adminSupabase
      .from('subscribers')
      .select('full_name')
      .eq('id', data.subscriber_id)
      .single();

    await logEventCreated(inserted?.id || '', subData?.full_name || 'Unknown', {
      event_name: data.event_name,
      event_date: data.event_date,
      event_time: data.event_time,
      recurring_frequency: data.recurring_frequency,
      recurring_count: data.recurring_count,
      recurring_indefinite: data.recurring_indefinite,
      notes: data.notes,
      referred_by: data.referred_by,
      form_number: data.form_number,
    });

    revalidatePath('/events');
    return { success: true, message: 'Event created successfully' };
  } catch (error: any) {
    console.error('Error creating event:', error);
    return { success: false, message: error.message || 'Failed to create event' };
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string,
  data: {
    event_name?: string;
    event_date?: string;
    event_time?: string;
    recurring_frequency?: string | null;
    recurring_count?: number | null;
    recurring_indefinite?: boolean;
    notes?: string;
    referred_by?: string;
    form_number?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const canUpdate = await hasPermission('UPDATE_EVENT');
  if (!canUpdate) {
    return { success: false, message: 'Unauthorized: You do not have permission to edit events' };
  }

  const adminSupabase = createAdminClient();

  try {
    // Fetch old data for diffing
    const { data: oldEvent } = await adminSupabase
      .from('events')
      .select('*, subscribers!inner(full_name)')
      .eq('id', eventId)
      .single();

    const updates: Record<string, unknown> = {};
    if (data.event_name !== undefined) updates.event_name = data.event_name;
    if (data.event_date !== undefined) updates.event_date = data.event_date;
    if (data.event_time !== undefined) updates.event_time = data.event_time || null;
    if (data.recurring_frequency !== undefined) updates.recurring_frequency = data.recurring_frequency || null;
    if (data.recurring_count !== undefined) updates.recurring_count = data.recurring_count;
    if (data.recurring_indefinite !== undefined) updates.recurring_indefinite = data.recurring_indefinite;
    if (data.notes !== undefined) updates.notes = data.notes || null;
    if (data.referred_by !== undefined) updates.referred_by = data.referred_by || null;
    if (data.form_number !== undefined) updates.form_number = data.form_number || null;

    const { error } = await adminSupabase
      .from('events')
      .update(updates)
      .eq('id', eventId);

    if (error) throw error;

    // Build changes diff for logging
    if (oldEvent) {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const fieldLabels: Record<string, string> = {
        event_name: 'Event Name',
        event_date: 'Date',
        event_time: 'Time',
        recurring_frequency: 'Recurring Frequency',
        recurring_count: 'Recurring Count',
        recurring_indefinite: 'Recurring Indefinite',
        notes: 'Notes',
        referred_by: 'Referred By',
        form_number: 'Form Number',
      };

      for (const [key, label] of Object.entries(fieldLabels)) {
        if (data[key as keyof typeof data] !== undefined && oldEvent[key] !== updates[key]) {
          changes[label] = { from: oldEvent[key], to: updates[key] };
        }
      }

      if (Object.keys(changes).length > 0) {
        const subscriberName = (oldEvent as any).subscribers?.full_name || 'Unknown';
        await logEventUpdated(eventId, subscriberName, changes);
      }
    }

    revalidatePath('/events');
    return { success: true, message: 'Event updated successfully' };
  } catch (error: any) {
    console.error('Error updating event:', error);
    return { success: false, message: error.message || 'Failed to update event' };
  }
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<{ success: boolean; message: string }> {
  const canDelete = await hasPermission('DELETE_EVENT');
  if (!canDelete) {
    return { success: false, message: 'Unauthorized: You do not have permission to delete events' };
  }

  const adminSupabase = createAdminClient();

  try {
    const { data: eventData } = await adminSupabase
      .from('events')
      .select('*, subscribers!inner(full_name)')
      .eq('id', eventId)
      .single();

    const { error } = await adminSupabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    if (eventData) {
      await logEventDeleted(eventId, (eventData as any).subscribers?.full_name || 'Unknown', {
        event_name: eventData.event_name,
        event_date: eventData.event_date,
      });
    }

    revalidatePath('/events');
    return { success: true, message: 'Event deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return { success: false, message: error.message || 'Failed to delete event' };
  }
}

/**
 * Search subscribers for the event modal
 */
export async function searchSubscribersForEvent(
  query: string
): Promise<
  {
    id: string;
    master_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  }[]
> {
  if (!query || query.trim().length < 1) return [];

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('subscribers')
    .select('id, master_id, full_name, email, phone')
    .or(
      `full_name.ilike.%${query.trim()}%,phone.ilike.%${query.trim()}%,master_id.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`
    )
    .limit(8);

  if (error || !data) return [];
  return data;
}
