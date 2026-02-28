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

  const { data: subscriber, error: subscriberError } = await supabase
    .from('subscribers')
    .select('*')
    .eq('id', id)
    .single();

  if (subscriberError || !subscriber) {
    return null;
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('subscriber_id', id)
    .order('payment_date', { ascending: false });

  const paymentList = (payments || []) as Payment[];
  const sub = subscriber as Subscriber;

  // Lazy recalculation: compute correct end date from all payment periods
  if (paymentList.length > 0) {
    const allPeriods: MonthSelection[] = [];
    for (const p of paymentList) {
      const periods = getPeriodsFromPayment(p);
      allPeriods.push(...periods);
    }

    const computedEndDate = calculateEndDateFromPeriods(allPeriods);
    if (computedEndDate) {
      const storedEnd = new Date(sub.subscription_end_date).getTime();
      const computedEnd = computedEndDate.getTime();

      // If computed end date differs from stored, update the DB
      if (computedEnd !== storedEnd) {
        const now = new Date();
        const newStatus = computedEnd > now.getTime() ? 'active' : sub.status;

        const adminSupabase = createAdminClient();
        await adminSupabase
          .from('subscribers')
          .update({
            subscription_end_date: computedEndDate.toISOString(),
            ...(newStatus === 'active' ? { status: 'active', status_notes: null } : {}),
          })
          .eq('id', id);

        // Update the in-memory subscriber object so the page renders correctly
        sub.subscription_end_date = computedEndDate.toISOString();
        if (newStatus === 'active') {
          sub.status = 'active';
          sub.status_notes = null;
        }
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
