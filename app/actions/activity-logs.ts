'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActivityLog } from '@/lib/types';
import { hasPermission, getCurrentUserRole } from '@/lib/rbac';

export interface ActivityLogsParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
}

export interface ActivityLogsResult {
  logs: ActivityLog[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get activity logs with pagination and filters
 * Uses admin client with server-side role-based filtering to avoid RLS issues
 * Note: activity_logs.user_id references auth.users, not profiles, so we fetch profiles separately
 */
export async function getActivityLogs(
  params: ActivityLogsParams = {}
): Promise<ActivityLogsResult> {
  // First check if user has permission to view logs
  const role = await getCurrentUserRole();
  
  if (!role || role === 'staff') {
    // Staff cannot view logs
    return {
      logs: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };
  }

  // Use admin client to bypass RLS, but apply role-based filtering server-side
  const supabase = createAdminClient();
  
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build query WITHOUT profile join (activity_logs.user_id references auth.users, not profiles)
  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' });

  // For admins, filter to only show staff logs and system logs
  if (role === 'admin') {
    // Get all staff user IDs first
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'staff');
    
    const staffIds = staffProfiles?.map(p => p.id) || [];
    
    // Filter logs to only those from staff users or system logs (no user_id)
    if (staffIds.length > 0) {
      query = query.or(`user_id.is.null,user_id.in.(${staffIds.join(',')})`);
    } else {
      query = query.is('user_id', null);
    }
  }
  // Super admins see all logs - no additional filtering needed

  // Apply user-requested filters
  if (params.userId) {
    query = query.eq('user_id', params.userId);
  }

  if (params.actionType && params.actionType !== 'all') {
    query = query.eq('action_type', params.actionType);
  }

  if (params.startDate) {
    query = query.gte('created_at', params.startDate);
  }

  if (params.endDate) {
    // Add a day to include the end date fully
    const endDate = new Date(params.endDate);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt('created_at', endDate.toISOString());
  }

  // Order and paginate
  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching activity logs:', error);
    return {
      logs: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Fetch profiles for users in the logs
  const userIds = [...new Set(data?.filter(log => log.user_id).map(log => log.user_id) || [])];
  let profilesMap: Record<string, { id: string; role: string; full_name: string | null }> = {};
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .in('id', userIds);
    
    if (profiles) {
      profilesMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, { id: string; role: string; full_name: string | null }>);
    }
  }

  // Attach profiles to logs
  const logsWithProfiles = (data || []).map(log => ({
    ...log,
    profiles: log.user_id ? profilesMap[log.user_id] || null : null,
  }));

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    logs: logsWithProfiles as ActivityLog[],
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get unique users who have activity logs (for filter dropdown)
 * Note: activity_logs.user_id references auth.users, not profiles, so we fetch profiles separately
 */
export async function getLogUsers(): Promise<{ id: string; full_name: string | null; role: string }[]> {
  const role = await getCurrentUserRole();
  
  if (!role || role === 'staff') {
    return [];
  }

  const supabase = createAdminClient();

  // Get unique user IDs from activity logs
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('user_id')
    .not('user_id', 'is', null);

  if (error) {
    console.error('Error fetching log users:', error);
    return [];
  }

  // Get unique user IDs
  const uniqueUserIds = [...new Set(logs?.map(log => log.user_id).filter(Boolean) || [])];
  
  if (uniqueUserIds.length === 0) {
    return [];
  }

  // Fetch profiles for these users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('id', uniqueUserIds);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }

  // Apply role-based filtering
  const filteredProfiles = (profiles || []).filter(profile => {
    // Admins can only see staff users
    if (role === 'admin' && profile.role !== 'staff') {
      return false;
    }
    return true;
  });

  return filteredProfiles.map(profile => ({
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
  }));
}

/**
 * Check if current user can view communication logs
 */
export async function canViewCommunicationLogs(): Promise<boolean> {
  return hasPermission('VIEW_COMMUNICATION_LOGS');
}
