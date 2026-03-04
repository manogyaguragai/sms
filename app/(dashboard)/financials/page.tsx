import { createClient } from '@/lib/supabase/server';
import { getNepaliMonthStartDate } from '@/lib/nepali-date';
import { FinancialsPageClient } from '@/components/financials-page-client';
import type { Payment } from '@/lib/types';

type SubscriptionType = 'all' | 'regular' | '12_hajar';

interface SegmentedStats {
  expectedMRR: number;
  activeUserCount: number;
  collectedThisMonth: number;
  usersWhoPayedThisMonth: number;
  paymentGap: number;
  pendingFirstPayment: number;
}

function isRegularPayment(paymentFor: string | null | undefined): boolean {
  return !paymentFor || paymentFor === 'monthly' || paymentFor === 'annually';
}

function is12HajarPayment(paymentFor: string | null | undefined): boolean {
  return paymentFor === '12_hajar';
}

async function getFinancialsData() {
  const supabase = await createClient();

  // Get all active subscribers with frequency info
  const { data: subscribers } = await supabase
    .from('subscribers')
    .select('id, full_name, status, frequency')
    .eq('status', 'active');

  // Get all payments (including payment_for for segmentation)
  const { data: allPayments } = await supabase
    .from('payments')
    .select('id, amount_paid, subscriber_id, payment_date, payment_for');

  // Count subscribers by frequency type
  let regularSubCount = 0;
  let twelveHajarSubCount = 0;

  if (subscribers) {
    subscribers.forEach((sub) => {
      const freqs = Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency];
      if (freqs.includes('monthly') || freqs.includes('annually')) {
        regularSubCount++;
      }
      if (freqs.includes('12_hajar')) {
        twelveHajarSubCount++;
      }
    });
  }

  const totalActiveCount = subscribers?.length || 0;

  // Expected MRR per type
  const regularMRR = regularSubCount * 500;
  const twelveHajarMRR = twelveHajarSubCount * 12000;
  const allMRR = regularMRR + twelveHajarMRR;

  // Group payments by subscriber for "pending first payment" calc
  const subscribersWithRegularPayment = new Set<string>();
  const subscribersWithTwelveHajarPayment = new Set<string>();
  const subscribersWithAnyPayment = new Set<string>();

  (allPayments || []).forEach(p => {
    subscribersWithAnyPayment.add(p.subscriber_id);
    if (is12HajarPayment(p.payment_for)) {
      subscribersWithTwelveHajarPayment.add(p.subscriber_id);
    }
    if (isRegularPayment(p.payment_for)) {
      subscribersWithRegularPayment.add(p.subscriber_id);
    }
  });

  // Pending first payment per type
  let pendingAll = 0;
  let pendingRegular = 0;
  let pending12Hajar = 0;

  if (subscribers) {
    subscribers.forEach((sub) => {
      const freqs = Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency];
      if (!subscribersWithAnyPayment.has(sub.id)) {
        pendingAll++;
      }
      if ((freqs.includes('monthly') || freqs.includes('annually')) && !subscribersWithRegularPayment.has(sub.id)) {
        pendingRegular++;
      }
      if (freqs.includes('12_hajar') && !subscribersWithTwelveHajarPayment.has(sub.id)) {
        pending12Hajar++;
      }
    });
  }

  // Calculate collected this month (Nepali month) per type
  const nepaliMonthStart = getNepaliMonthStartDate();
  const thisMonthPayments = (allPayments || []).filter(
    p => new Date(p.payment_date) >= nepaliMonthStart
  );

  // All
  const collectedAll = thisMonthPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const usersAll = new Set(thisMonthPayments.map(p => p.subscriber_id)).size;

  // Regular
  const regularMonthPayments = thisMonthPayments.filter(p => isRegularPayment(p.payment_for));
  const collectedRegular = regularMonthPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const usersRegular = new Set(regularMonthPayments.map(p => p.subscriber_id)).size;

  // 12 Hajar
  const twelveHajarMonthPayments = thisMonthPayments.filter(p => is12HajarPayment(p.payment_for));
  const collected12Hajar = twelveHajarMonthPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const users12Hajar = new Set(twelveHajarMonthPayments.map(p => p.subscriber_id)).size;

  const stats: Record<SubscriptionType, SegmentedStats> = {
    all: {
      expectedMRR: allMRR,
      activeUserCount: totalActiveCount,
      collectedThisMonth: collectedAll,
      usersWhoPayedThisMonth: usersAll,
      paymentGap: allMRR - collectedAll,
      pendingFirstPayment: pendingAll,
    },
    regular: {
      expectedMRR: regularMRR,
      activeUserCount: regularSubCount,
      collectedThisMonth: collectedRegular,
      usersWhoPayedThisMonth: usersRegular,
      paymentGap: regularMRR - collectedRegular,
      pendingFirstPayment: pendingRegular,
    },
    '12_hajar': {
      expectedMRR: twelveHajarMRR,
      activeUserCount: twelveHajarSubCount,
      collectedThisMonth: collected12Hajar,
      usersWhoPayedThisMonth: users12Hajar,
      paymentGap: twelveHajarMRR - collected12Hajar,
      pendingFirstPayment: pending12Hajar,
    },
  };

  // Get all subscribers for the analytics dropdown
  const { data: allSubscribers } = await supabase
    .from('subscribers')
    .select('id, full_name')
    .order('full_name');

  return {
    stats,
    subscribers: allSubscribers || [],
    payments: allPayments || [],
  };
}

export default async function FinancialsPage() {
  const { stats, subscribers, payments } = await getFinancialsData();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Financials</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Revenue analytics and payment tracking
        </p>
      </div>

      <FinancialsPageClient
        stats={stats}
        subscribers={subscribers}
        payments={payments as Payment[]}
      />
    </div>
  );
}
