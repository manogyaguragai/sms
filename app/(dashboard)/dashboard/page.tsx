import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertTriangle, Receipt, ArrowRight } from 'lucide-react';
import { addDays } from 'date-fns';
import Link from 'next/link';
import NepaliDate from 'nepali-date-converter';
import type { Subscriber } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';
import { ExpiringSubscribersList } from '@/components/expiring-subscribers-list';
import { TopSubscribersCard } from '@/components/top-subscribers-card';
import { NEPALI_MONTHS, NEPALI_MONTHS_SHORT } from '@/lib/nepali-date';
import { formatNepaliDate } from '@/lib/nepali-date';
import type { CollectionRateMonthData, CollectionPaymentRecord } from '@/components/collection-rate-chart';

/**
 * Given a Nepali year and month (0-indexed), return the JS Date range [start, end)
 * where start = 1st of that Nepali month and end = 1st of the next Nepali month.
 */
function getNepaliMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new NepaliDate(year, month, 1).toJsDate();

  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const end = new NepaliDate(nextYear, nextMonth, 1).toJsDate();

  return { start, end };
}

/**
 * Expected revenue per subscriber per interval:
 *   monthly = Rs. 500 per month
 *   annual  = Rs. 6,000 per year
 *   12_hajar = Rs. 12,000 per year
 */
const EXPECTED_RATE: Record<string, number> = {
  monthly: 500,
  annual: 6000,
  '12_hajar': 12000,
};

/** Frequencies that renew yearly — chart shows year-level intervals. */
const YEARLY_FREQUENCIES = new Set(['annual', '12_hajar']);

/**
 * Normalize frequency keys. payments.payment_for may use 'annually'
 * while subscribers.frequency uses 'annual'.
 */
function normalizeFreq(f: string): string {
  if (f === 'annually') return 'annual';
  return f;
}

/**
 * Return the JS Date range [start, end) spanning an entire Nepali year
 * (Baisakh 1 of `year` to Baisakh 1 of `year+1`).
 */
function getNepaliYearRange(year: number): { start: Date; end: Date } {
  const start = new NepaliDate(year, 0, 1).toJsDate(); // Baisakh 1
  const end = new NepaliDate(year + 1, 0, 1).toJsDate();
  return { start, end };
}

/**
 * Compute Payment Collection Rate data per frequency type.
 *
 * - **monthly**: last 6 completed Nepali months + current month (7 intervals).
 * - **annual / 12_hajar**: last 3 completed Nepali years + current year (4 intervals).
 *
 * For each interval:
 *   1. Count subscribers of that frequency who existed before interval end → expected.
 *   2. Sum matching payments whose payment_date falls within the interval → collected.
 *   3. rate = (collected / expected) × 100.
 *   4. Individual payment records included for the detail modal.
 */
function computeCollectionRateData(
  allSubscribers: {
    id: string;
    full_name: string;
    status: string;
    frequency: string[];
    created_at: string;
  }[],
  allPayments: {
    subscriber_id: string;
    amount_paid: number;
    payment_for: string | null;
    payment_date: string | null;
  }[]
): Record<string, CollectionRateMonthData[]> {
  const now = new Date();
  const currentNepali = new NepaliDate(now);
  const currentYear = currentNepali.getYear();
  const currentMonth = currentNepali.getMonth(); // 0-indexed

  const frequencyTypes = ['monthly', 'annual', '12_hajar'];
  const result: Record<string, CollectionRateMonthData[]> = {};

  // Build subscriber name map
  const subscriberNameById = new Map<string, string>();
  for (const sub of allSubscribers) {
    subscriberNameById.set(sub.id, sub.full_name);
  }

  // Build subscriber lookup for frequency inference when payment_for is null
  const subscriberFreqById = new Map<string, string[]>();
  for (const sub of allSubscribers) {
    subscriberFreqById.set(
      sub.id,
      (Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency]).map(normalizeFreq)
    );
  }

  // Precompute subscriber counts per frequency (current active base)
  const subscriberCountByFreq = new Map<string, number>();
  for (const freq of frequencyTypes) {
    let count = 0;
    for (const sub of allSubscribers) {
      const freqs = (Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency]).map(normalizeFreq);
      if (freqs.includes(freq)) count++;
    }
    subscriberCountByFreq.set(freq, count);
  }

  /** Shared logic for a single interval. */
  function computeInterval(
    freq: string,
    label: string,
    rangeStart: Date,
    rangeEnd: Date
  ): CollectionRateMonthData {
    const subCount = subscriberCountByFreq.get(freq) || 0;
    const expected = subCount * (EXPECTED_RATE[freq] || 0);

    // Sum payments in this range for this frequency
    let collected = 0;
    const payments: CollectionPaymentRecord[] = [];

    for (const p of allPayments) {
      if (!p.payment_date) continue;
      const pDate = new Date(p.payment_date);
      if (pDate < rangeStart || pDate >= rangeEnd) continue;

      let pFreqs: string[];
      if (p.payment_for) {
        pFreqs = [normalizeFreq(p.payment_for)];
      } else {
        pFreqs = subscriberFreqById.get(p.subscriber_id) || [];
      }
      if (!pFreqs.includes(freq)) continue;

      const amount = Number(p.amount_paid);
      collected += amount;
      payments.push({
        subscriberName: subscriberNameById.get(p.subscriber_id) || 'Unknown',
        amount,
        paymentDate: formatNepaliDate(pDate, 'long'),
      });
    }

    const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

    return {
      month: label,
      expected,
      collected,
      rate,
      subscriberCount: subCount,
      payments,
    };
  }

  for (const freq of frequencyTypes) {
    const intervals: CollectionRateMonthData[] = [];

    if (YEARLY_FREQUENCIES.has(freq)) {
      // Yearly intervals: last 3 completed years + current year
      for (let i = 3; i >= 0; i--) {
        const targetYear = currentYear - i;
        const { start, end } = getNepaliYearRange(targetYear);
        intervals.push(computeInterval(freq, `${targetYear}`, start, end));
      }
    } else {
      // Monthly intervals: last 6 completed months + current month
      for (let i = 6; i >= 0; i--) {
        let targetMonth = currentMonth - i;
        let targetYear = currentYear;
        while (targetMonth < 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        const { start, end } = getNepaliMonthRange(targetYear, targetMonth);
        const label = `${NEPALI_MONTHS_SHORT[targetMonth]} ${targetYear}`;
        intervals.push(computeInterval(freq, label, start, end));
      }
    }

    result[freq] = intervals;
  }

  return result;
}

async function getDashboardData() {
  const supabase = await createClient();
  const tenDaysFromNow = addDays(new Date(), 10).toISOString();
  const now = new Date().toISOString();

  // Run all independent queries in parallel for maximum speed
  const [
    { data: activeSubscribers },
    { count: totalAllSubscribers },
    { data: expiringSoon },
    { data: allPayments },
    { data: allSubscribersForNames },
    { data: allSubscribersForRetention },
  ] = await Promise.all([
    // Get all active subscribers
    supabase
      .from('subscribers')
      .select('*')
      .eq('status', 'active'),
    // Get total subscriber count (all statuses)
    supabase
      .from('subscribers')
      .select('*', { count: 'exact', head: true }),
    // Get expiring soon (next 10 days)
    supabase
      .from('subscribers')
      .select('*')
      .eq('status', 'active')
      .lte('subscription_end_date', tenDaysFromNow)
      .gte('subscription_end_date', now)
      .order('subscription_end_date', { ascending: true }),
    // Get all payments (for revenue + collection rate analytics)
    supabase
      .from('payments')
      .select('amount_paid, subscriber_id, payment_date, payment_for'),
    // Get all subscriber names (for top subscribers)
    supabase
      .from('subscribers')
      .select('id, full_name'),
    // Get ALL subscribers (all statuses) for collection rate chart
    supabase
      .from('subscribers')
      .select('id, full_name, status, frequency, created_at'),
  ]);

  // Calculate total revenue
  const totalRevenue = (allPayments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);

  // Calculate top subscribers by total payments
  const paymentTotalsBySubscriber = new Map<string, { id: string; full_name: string; totalPaid: number }>();
  (allPayments || []).forEach(p => {
    const existing = paymentTotalsBySubscriber.get(p.subscriber_id);
    if (existing) {
      existing.totalPaid += Number(p.amount_paid);
    } else {
      paymentTotalsBySubscriber.set(p.subscriber_id, {
        id: p.subscriber_id,
        full_name: '',
        totalPaid: Number(p.amount_paid),
      });
    }
  });

  const subscriberNames = new Map<string, string>();
  (allSubscribersForNames || []).forEach(s => {
    subscriberNames.set(s.id, s.full_name);
  });

  // Fill in names and sort by total paid
  const topSubscribers = Array.from(paymentTotalsBySubscriber.values())
    .map(s => ({
      ...s,
      full_name: subscriberNames.get(s.id) || 'Unknown',
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, 3);

  // Plan distribution for chart
  const planCounts = { monthly: 0, yearly: 0, twelveHajar: 0 };
  if (activeSubscribers) {
    activeSubscribers.forEach((sub: Subscriber) => {
      const freqs = Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency];
      for (const freq of freqs) {
        if (freq === 'monthly') {
          planCounts.monthly++;
        } else if (freq === '12_hajar') {
          planCounts.twelveHajar++;
        } else {
          planCounts.yearly++;
        }
      }
    });
  }

  const chartData = {
    plans: [
      { name: 'Monthly', value: planCounts.monthly },
      { name: 'Annual', value: planCounts.yearly },
      { name: '12 Hajar', value: planCounts.twelveHajar },
    ].filter(i => i.value > 0)
  };

  // Compute collection rate data per frequency type
  const collectionRateData = computeCollectionRateData(
    (allSubscribersForRetention || []).map(s => ({
      id: s.id,
      full_name: s.full_name,
      status: s.status,
      frequency: Array.isArray(s.frequency) ? s.frequency : [s.frequency],
      created_at: s.created_at,
    })),
    (allPayments || []).map(p => ({
      subscriber_id: p.subscriber_id,
      amount_paid: Number(p.amount_paid),
      payment_for: p.payment_for,
      payment_date: p.payment_date,
    }))
  );

  return {
    totalSubscribers: activeSubscribers?.length || 0,
    totalAllSubscribers: totalAllSubscribers || 0,
    expiringSoon: (expiringSoon || []) as Subscriber[],
    chartData,
    totalRevenue,
    topSubscribers,
    collectionRateData,
  };
}

export default async function DashboardPage() {
  const { totalSubscribers, totalAllSubscribers, expiringSoon, chartData, totalRevenue, topSubscribers, collectionRateData } = await getDashboardData();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Overview of your subscription management system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatsCard
          title="Active Subscribers"
          value={`${totalSubscribers}/${totalAllSubscribers}`}
          subtitle="Active out of total"
          icon={Users}
          href="/subscribers"
        />
        <StatsCard
          title="Expiring Soon"
          value={expiringSoon.length}
          subtitle="Within next 10 days"
          icon={AlertTriangle}
          href="/subscribers"
        />
        <StatsCard
          title="Total Revenue"
          value={`Rs. ${totalRevenue.toLocaleString('en-IN')}`}
          subtitle="All-time collections"
          icon={Receipt}
          href="/subscribers"
        />
        <TopSubscribersCard subscribers={topSubscribers} />
      </div>

      {/* Charts */}
      <DashboardCharts collectionRateData={collectionRateData} planData={chartData.plans} />

      {/* Expiring Soon List */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Expiring Soon
          </CardTitle>
          <Link
            href="/subscribers"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <ExpiringSubscribersList subscribers={expiringSoon} />
        </CardContent>
      </Card>
    </div>
  );
}
