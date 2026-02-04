'use server';

import { createClient } from '@/lib/supabase/server';
import type { Subscriber } from '@/lib/types';

export type SortColumn = 'full_name' | 'subscription_end_date';
export type SortOrder = 'asc' | 'desc';

export interface PaginatedSubscribersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  frequency?: string;
  noPayments?: boolean;
  sortBy?: SortColumn;
  sortOrder?: SortOrder;
}

export interface PaginatedSubscribersResult {
  subscribers: Subscriber[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getSubscribersPaginated(
  params: PaginatedSubscribersParams
): Promise<PaginatedSubscribersResult> {
  const supabase = await createClient();
  
  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const search = params.search || '';
  const status = params.status || '';
  const frequency = params.frequency || '';
  const noPayments = params.noPayments || false;
  const sortBy = params.sortBy || 'subscription_end_date';
  const sortOrder = params.sortOrder || 'asc';

  // Calculate offset
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // If filtering by no payments, we need to get subscriber IDs that have no payments
  let subscriberIdsWithNoPayments: string[] | null = null;
  if (noPayments) {
    // Get all subscriber IDs
    const { data: allSubscribers } = await supabase
      .from('subscribers')
      .select('id');
    
    // Get all subscriber IDs that have payments
    const { data: payments } = await supabase
      .from('payments')
      .select('subscriber_id');
    
    const subscriberIdsWithPayments = new Set(
      (payments || []).map(p => p.subscriber_id)
    );
    
    subscriberIdsWithNoPayments = (allSubscribers || [])
      .map(s => s.id)
      .filter(id => !subscriberIdsWithPayments.has(id));
  }

  // Build the query
  let query = supabase
    .from('subscribers')
    .select('*', { count: 'exact' });

  // Apply no payments filter
  if (noPayments && subscriberIdsWithNoPayments !== null) {
    if (subscriberIdsWithNoPayments.length === 0) {
      // No subscribers without payments, return empty
      return {
        subscribers: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }
    query = query.in('id', subscriberIdsWithNoPayments);
  }

  // Apply search filter (search in full_name and email)
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // Apply status filter
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  // Apply frequency filter
  if (frequency && frequency !== 'all') {
    query = query.eq('frequency', frequency);
  }

  // Apply ordering and pagination
  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching subscribers:', error);
    return {
      subscribers: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    subscribers: data as Subscriber[],
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}
