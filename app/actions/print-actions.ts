'use server';

import { createClient } from '@/lib/supabase/server';
import type { Subscriber, Payment } from '@/lib/types';

export interface SubscriberPrintData extends Subscriber {
  total_paid: number;
  payment_count: number;
  last_payment_date: string | null;
}

/**
 * Fetch all subscribers with aggregated payment data for the print list.
 */
export async function getAllSubscribersForPrint(): Promise<SubscriberPrintData[]> {
  const supabase = await createClient();

  // Get all subscribers
  const { data: subscribers, error: subError } = await supabase
    .from('subscribers')
    .select('*')
    .order('full_name', { ascending: true });

  if (subError || !subscribers) {
    console.error('Error fetching subscribers for print:', subError);
    return [];
  }

  // Get payment aggregates per subscriber
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('subscriber_id, amount_paid, payment_date');

  if (payError) {
    console.error('Error fetching payments for print:', payError);
  }

  // Aggregate payment data
  const paymentMap = new Map<string, { total: number; count: number; lastDate: string | null }>();
  for (const p of (payments || [])) {
    const existing = paymentMap.get(p.subscriber_id);
    if (existing) {
      existing.total += Number(p.amount_paid);
      existing.count += 1;
      if (!existing.lastDate || p.payment_date > existing.lastDate) {
        existing.lastDate = p.payment_date;
      }
    } else {
      paymentMap.set(p.subscriber_id, {
        total: Number(p.amount_paid),
        count: 1,
        lastDate: p.payment_date,
      });
    }
  }

  return (subscribers as Subscriber[]).map((sub) => {
    const agg = paymentMap.get(sub.id);
    return {
      ...sub,
      total_paid: agg?.total || 0,
      payment_count: agg?.count || 0,
      last_payment_date: agg?.lastDate || null,
    };
  });
}

/**
 * Fetch payments for a subscriber, optionally filtered by date range.
 * Returns payments sorted oldest-first for statement chronology.
 */
export async function getSubscriberPayments(
  subscriberId: string,
  startDate?: string,
  endDate?: string
): Promise<Payment[]> {
  const supabase = await createClient();

  let query = supabase
    .from('payments')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .order('payment_date', { ascending: true });

  if (startDate) {
    // Append start-of-day if the value is a date-only string (YYYY-MM-DD)
    const adjustedStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
    query = query.gte('payment_date', adjustedStart);
  }
  if (endDate) {
    // Append end-of-day if the value is a date-only string (YYYY-MM-DD)
    const adjustedEnd = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
    query = query.lte('payment_date', adjustedEnd);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching subscriber payments:', error);
    return [];
  }

  return (data || []) as Payment[];
}
