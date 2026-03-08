import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { SubscriberProfile } from '@/components/subscriber-profile';
import type { Subscriber, Payment } from '@/lib/types';
import NepaliDate from 'nepali-date-converter';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Nepali month names for notes parsing
const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

interface MonthSelection {
  month: number;
  year: number;
}

/**
 * Parse ALL periods from notes field (e.g., "Payment for: Poush 2082, Magh 2082, Falgun 2082")
 */
function parsePeriodsFromNotes(notesStr: string): MonthSelection[] {
  const results: MonthSelection[] = [];
  try {
    const regex = /([A-Za-z]+)\s+(\d{4})/g;
    let match;
    while ((match = regex.exec(notesStr)) !== null) {
      const monthName = match[1];
      const year = parseInt(match[2], 10);
      const monthIndex = NEPALI_MONTHS.findIndex(
        m => m.toLowerCase() === monthName.toLowerCase()
      );
      if (monthIndex !== -1 && !isNaN(year)) {
        results.push({ month: monthIndex, year });
      }
    }
  } catch {
    // ignore
  }
  return results;
}

/**
 * Get all Nepali month/year periods from a payment record (notes first, then date fallback)
 */
function getPeriodsFromPayment(payment: Payment): MonthSelection[] {
  // Try parsing from notes (gets all months from multi-month payments)
  if (payment.notes) {
    const fromNotes = parsePeriodsFromNotes(payment.notes);
    if (fromNotes.length > 0) return fromNotes;
  }
  // Fallback: try date conversion
  if (payment.payment_for_period) {
    try {
      const date = new Date(payment.payment_for_period);
      const nepaliDate = new NepaliDate(date);
      return [{ month: nepaliDate.getMonth(), year: nepaliDate.getYear() }];
    } catch {
      // ignore
    }
  }
  return [];
}

/**
 * Calculate subscription end date from all payment periods
 */
function calculateEndDateFromPeriods(periods: MonthSelection[]): Date | null {
  // Deduplicate
  const seen = new Set<string>();
  const uniquePeriods = periods.filter(m => {
    const key = `${m.year}-${m.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniquePeriods.length === 0) return null;

  // Sort to find the last period
  const sorted = uniquePeriods.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  const lastPeriod = sorted[sorted.length - 1];

  // End date is always the 1st of the month after the last paid period
  let endMonth = lastPeriod.month + 1;
  let endYear = lastPeriod.year;
  if (endMonth > 11) {
    endMonth = 0;
    endYear = endYear + 1;
  }
  return new NepaliDate(endYear, endMonth, 1).toJsDate();
}

async function getSubscriber(id: string) {
  const supabase = await createClient();

  // Run subscriber and payments queries in parallel
  const [subscriberResult, paymentsResult] = await Promise.all([
    supabase
      .from('subscribers')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('payments')
      .select('*')
      .eq('subscriber_id', id)
      .order('payment_date', { ascending: false }),
  ]);

  const { data: subscriber, error: subscriberError } = subscriberResult;
  const { data: payments } = paymentsResult;

  if (subscriberError || !subscriber) {
    return null;
  }

  const paymentList = (payments || []) as Payment[];
  const sub = subscriber as Subscriber;

  // Lazy recalculation: compute per-frequency end dates from payments grouped by payment_for
  {
    const frequencies: string[] = sub.frequency || [];
    const computedEndDates: Record<string, string> = {};

    // Group payments by payment_for and calculate end date per frequency
    for (const freq of frequencies) {
      const freqPayments = paymentList.filter(p => p.payment_for === freq);
      if (freqPayments.length === 0) continue; // No payments = no end date for this frequency

      const freqPeriods: MonthSelection[] = [];
      for (const p of freqPayments) {
        const periods = getPeriodsFromPayment(p);
        freqPeriods.push(...periods);
      }

      const freqEndDate = calculateEndDateFromPeriods(freqPeriods);
      if (freqEndDate) {
        computedEndDates[freq] = freqEndDate.toISOString();
      }
    }

    // Determine soonest end date across frequencies that have payments
    const allEndDateValues = Object.values(computedEndDates).map(d => new Date(d).getTime());
    const soonestEndDate = allEndDateValues.length > 0
      ? new Date(Math.min(...allEndDateValues)).toISOString()
      : sub.subscription_end_date; // Keep existing if no payments at all

    // Check if anything changed
    const storedEndDates: Record<string, string> = sub.subscription_end_dates || {};
    const endDatesChanged = JSON.stringify(computedEndDates) !== JSON.stringify(storedEndDates);
    const soonestChanged = soonestEndDate !== sub.subscription_end_date;

    if (endDatesChanged || soonestChanged) {
      const now = new Date();
      const newStatus = allEndDateValues.length > 0 && new Date(soonestEndDate).getTime() > now.getTime()
        ? 'active' : sub.status;

      const adminSupabase = createAdminClient();
      await adminSupabase
        .from('subscribers')
        .update({
          subscription_end_date: soonestEndDate,
          subscription_end_dates: computedEndDates,
          ...(newStatus === 'active' ? { status: 'active', status_notes: null } : {}),
        })
        .eq('id', id);

      // Update in-memory subscriber object
      sub.subscription_end_date = soonestEndDate;
      sub.subscription_end_dates = computedEndDates;
      if (newStatus === 'active') {
        sub.status = 'active';
        sub.status_notes = null;
      }
    }
  }

  return {
    subscriber: sub,
    payments: paymentList,
  };
}

export default async function SubscriberDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getSubscriber(id);

  if (!data) {
    notFound();
  }

  return <SubscriberProfile subscriber={data.subscriber} payments={data.payments} />;
}
