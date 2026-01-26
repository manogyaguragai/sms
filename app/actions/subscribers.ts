'use server';

import { createClient } from '@/lib/supabase/server';
import type { Subscriber } from '@/lib/types';

export interface PaginatedSubscribersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  frequency?: string;
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

  // Calculate offset
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build the query
  let query = supabase
    .from('subscribers')
    .select('*', { count: 'exact' });

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
    .order('created_at', { ascending: false })
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
