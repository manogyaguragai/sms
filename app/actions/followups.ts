'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { hasPermission } from '@/lib/rbac';
import { logFollowupCreated, logFollowupUpdated, logFollowupDeleted } from '@/lib/activity-logger';
import type { FollowupWithDetails } from '@/lib/types';

export type FollowupSortColumn = 'created_at' | 'followup_date';
export type FollowupSortOrder = 'asc' | 'desc';

export interface PaginatedFollowupsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: FollowupSortColumn;
  sortOrder?: FollowupSortOrder;
}

export interface PaginatedFollowupsResult {
  followups: FollowupWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Resolve made_by UUIDs to profile names
 */
async function resolveMadeByNames(
  madeByIds: string[],
  profileCache: Map<string, string>
): Promise<string[]> {
  const missingIds = madeByIds.filter((id) => !profileCache.has(id));

  if (missingIds.length > 0) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', missingIds);

    if (data) {
      for (const p of data) {
        profileCache.set(p.id, p.full_name || 'Unknown');
      }
    }
  }

  return madeByIds.map((id) => profileCache.get(id) || 'Unknown');
}

/**
 * Get paginated followups with search
 */
export async function getFollowupsPaginated(
  params: PaginatedFollowupsParams
): Promise<PaginatedFollowupsResult> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const search = params.search?.trim() || '';
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // If there's a search term, find matching subscriber IDs and profile IDs first
  let matchingSubscriberIds: string[] | null = null;
  let matchingProfileIds: string[] | null = null;

  if (search) {
    // 1. Find subscribers matching name, master_id, or phone
    const { data: matchingSubs } = await adminSupabase
      .from('subscribers')
      .select('id')
      .or(
        `full_name.ilike.%${search}%,master_id.ilike.%${search}%,phone.ilike.%${search}%`
      );
    matchingSubscriberIds = (matchingSubs || []).map((s) => s.id);

    // 2. Find profiles matching full_name (for "made by" search)
    const { data: matchingProfiles } = await adminSupabase
      .from('profiles')
      .select('id')
      .ilike('full_name', `%${search}%`);
    matchingProfileIds = (matchingProfiles || []).map((p) => p.id);
  }

  // Build the followups query — join subscribers for display
  let query = supabase
    .from('followups')
    .select(
      '*, subscribers!inner(id, full_name, master_id, phone, email)',
      { count: 'exact' }
    );

  // Apply search filter using only followups-level columns
  if (search) {
    const orParts: string[] = [];

    // Match by phone_number on followups table
    orParts.push(`phone_number.ilike.%${search}%`);

    // Match by subscriber IDs found above
    if (matchingSubscriberIds && matchingSubscriberIds.length > 0) {
      orParts.push(`subscriber_id.in.(${matchingSubscriberIds.join(',')})`);
    }

    // Match by profile IDs (made_by array overlaps with matching profile IDs)
    if (matchingProfileIds && matchingProfileIds.length > 0) {
      orParts.push(`made_by.ov.{${matchingProfileIds.join(',')}}`);
    }

    query = query.or(orParts.join(','));
  }

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching followups:', error);
    return {
      followups: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve made_by names
  const profileCache = new Map<string, string>();
  const followups: FollowupWithDetails[] = [];

  for (const row of data || []) {
    const madeByNames = await resolveMadeByNames(
      row.made_by || [],
      profileCache
    );
    followups.push({
      ...row,
      made_by_names: madeByNames,
    } as FollowupWithDetails);
  }

  return {
    followups,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get followups for a specific subscriber (paginated)
 */
export async function getFollowupsBySubscriber(
  subscriberId: string,
  page: number = 1,
  pageSize: number = 5
): Promise<PaginatedFollowupsResult> {
  const supabase = await createClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('followups')
    .select(
      '*, subscribers!inner(id, full_name, master_id, phone, email)',
      { count: 'exact' }
    )
    .eq('subscriber_id', subscriberId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching subscriber followups:', error);
    return {
      followups: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve made_by names
  const profileCache = new Map<string, string>();
  const followups: FollowupWithDetails[] = [];

  for (const row of data || []) {
    const madeByNames = await resolveMadeByNames(
      row.made_by || [],
      profileCache
    );
    followups.push({
      ...row,
      made_by_names: madeByNames,
    } as FollowupWithDetails);
  }

  return {
    followups,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Create a new followup record
 */
export async function createFollowup(data: {
  subscriber_id: string;
  made_by: string[];
  phone_number?: string;
  followup_date: string;
  followup_time?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string }> {
  const canCreate = await hasPermission('CREATE_FOLLOWUP');
  if (!canCreate) {
    return {
      success: false,
      message: 'Unauthorized: You do not have permission to create followups',
    };
  }

  const supabase = await createClient();

  // Get current user id for created_by
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Not authenticated' };
  }

  const adminSupabase = createAdminClient();

  try {
    const { data: inserted, error } = await adminSupabase.from('followups').insert({
      subscriber_id: data.subscriber_id,
      made_by: data.made_by,
      phone_number: data.phone_number || null,
      followup_date: data.followup_date,
      followup_time: data.followup_time || null,
      notes: data.notes || null,
      created_by: user.id,
    }).select('id').single();

    if (error) throw error;

    // Get subscriber name and made_by names for logging
    const { data: subData } = await adminSupabase
      .from('subscribers')
      .select('full_name')
      .eq('id', data.subscriber_id)
      .single();

    const { data: profilesData } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .in('id', data.made_by);

    const madeByNames = (profilesData || []).map(p => p.full_name || 'Unknown');

    await logFollowupCreated(inserted?.id || '', subData?.full_name || 'Unknown', {
      followup_date: data.followup_date,
      made_by_names: madeByNames,
      phone_number: data.phone_number,
      followup_time: data.followup_time,
      notes: data.notes,
    });

    revalidatePath('/followups');
    return { success: true, message: 'Followup recorded successfully' };
  } catch (error: any) {
    console.error('Error creating followup:', error);
    return { success: false, message: error.message || 'Failed to create followup' };
  }
}

/**
 * Update an existing followup record
 */
export async function updateFollowup(
  followupId: string,
  data: {
    made_by?: string[];
    phone_number?: string;
    followup_date?: string;
    followup_time?: string;
    notes?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const canUpdate = await hasPermission('UPDATE_FOLLOWUP');
  if (!canUpdate) {
    return {
      success: false,
      message: 'Unauthorized: You do not have permission to edit followups',
    };
  }

  const adminSupabase = createAdminClient();

  try {
    // Fetch old followup data for diffing
    const { data: oldFollowup } = await adminSupabase
      .from('followups')
      .select('*, subscribers!inner(full_name)')
      .eq('id', followupId)
      .single();

    const updates: Record<string, unknown> = {};
    if (data.made_by !== undefined) updates.made_by = data.made_by;
    if (data.phone_number !== undefined) updates.phone_number = data.phone_number || null;
    if (data.followup_date !== undefined) updates.followup_date = data.followup_date;
    if (data.followup_time !== undefined) updates.followup_time = data.followup_time || null;
    if (data.notes !== undefined) updates.notes = data.notes || null;

    const { error } = await adminSupabase
      .from('followups')
      .update(updates)
      .eq('id', followupId);

    if (error) throw error;

    // Build changes diff for logging
    if (oldFollowup) {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const fieldLabels: Record<string, string> = {
        phone_number: 'Phone Number',
        followup_date: 'Date',
        followup_time: 'Time',
        notes: 'Notes',
      };

      for (const [key, label] of Object.entries(fieldLabels)) {
        if (data[key as keyof typeof data] !== undefined && oldFollowup[key] !== updates[key]) {
          changes[label] = { from: oldFollowup[key], to: updates[key] };
        }
      }

      // Handle made_by separately (compare arrays)
      if (data.made_by !== undefined) {
        const oldMadeBy = (oldFollowup.made_by || []).sort().join(',');
        const newMadeBy = (data.made_by || []).sort().join(',');
        if (oldMadeBy !== newMadeBy) {
          // Resolve names
          const allIds = [...new Set([...(oldFollowup.made_by || []), ...(data.made_by || [])])];
          const { data: profilesData } = await adminSupabase
            .from('profiles')
            .select('id, full_name')
            .in('id', allIds);
          const nameMap = new Map((profilesData || []).map(p => [p.id, p.full_name || 'Unknown']));
          changes['Made By'] = {
            from: (oldFollowup.made_by || []).map((id: string) => nameMap.get(id) || 'Unknown'),
            to: (data.made_by || []).map((id: string) => nameMap.get(id) || 'Unknown'),
          };
        }
      }

      if (Object.keys(changes).length > 0) {
        const subscriberName = (oldFollowup as any).subscribers?.full_name || 'Unknown';
        await logFollowupUpdated(followupId, subscriberName, changes);
      }
    }

    revalidatePath('/followups');
    return { success: true, message: 'Followup updated successfully' };
  } catch (error: any) {
    console.error('Error updating followup:', error);
    return { success: false, message: error.message || 'Failed to update followup' };
  }
}

/**
 * Delete a followup record
 */
export async function deleteFollowup(
  followupId: string
): Promise<{ success: boolean; message: string }> {
  const canDelete = await hasPermission('DELETE_FOLLOWUP');
  if (!canDelete) {
    return {
      success: false,
      message: 'Unauthorized: You do not have permission to delete followups',
    };
  }

  const adminSupabase = createAdminClient();

  try {
    // Fetch followup data before deletion for logging
    const { data: followupData } = await adminSupabase
      .from('followups')
      .select('*, subscribers!inner(full_name)')
      .eq('id', followupId)
      .single();

    const { error } = await adminSupabase
      .from('followups')
      .delete()
      .eq('id', followupId);

    if (error) throw error;

    // Log the deletion
    if (followupData) {
      const { data: profilesData } = await adminSupabase
        .from('profiles')
        .select('full_name')
        .in('id', followupData.made_by || []);

      const madeByNames = (profilesData || []).map((p: any) => p.full_name || 'Unknown');

      await logFollowupDeleted(followupId, (followupData as any).subscribers?.full_name || 'Unknown', {
        followup_date: followupData.followup_date,
        made_by_names: madeByNames,
      });
    }

    revalidatePath('/followups');
    return { success: true, message: 'Followup deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting followup:', error);
    return { success: false, message: error.message || 'Failed to delete followup' };
  }
}

/**
 * Search subscribers for the followup modal (name, phone, master_id, email)
 */
export async function searchSubscribersForFollowup(
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

/**
 * Get all user profiles for the "made by" multiselect
 */
export async function getAllProfiles(): Promise<
  { id: string; full_name: string | null; role: string }[]
> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  if (error || !data) return [];
  return data;
}
