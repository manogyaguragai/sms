import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/stats-card';
import { FinancialsAnalytics } from '@/components/financials-analytics';
import { DollarSign, TrendingUp, TrendingDown, UserPlus } from 'lucide-react';
import type { Subscriber, Payment } from '@/lib/types';

async function getFinancialsData() {
  const supabase = await createClient();

  // Get all active subscribers
  const { data: subscribers } = await supabase
    .from('subscribers')
    .select('id, full_name, status, frequency')
    .eq('status', 'active');

  // Get all payments for analytics
  const { data: allPayments } = await supabase
    .from('payments')
    .select('id, amount_paid, subscriber_id, payment_date');

  // Count active subscribers for Expected MRR
  const activeUserCount = subscribers?.length || 0;

  // Expected MRR: Simple calculation (users × Rs.500)
  const expectedMRR = activeUserCount * 500;

  // Group payments by subscriber (for identifying who has made payments)
  const subscribersWithPayments = new Set<string>();
  (allPayments || []).forEach(p => {
    subscribersWithPayments.add(p.subscriber_id);
  });

  // Count pending first payment
  let pendingFirstPayment = 0;
  if (subscribers) {
    subscribers.forEach((sub) => {
      if (!subscribersWithPayments.has(sub.id)) {
        pendingFirstPayment++;
      }
    });
  }

  // Calculate collected this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthPayments = (allPayments || []).filter(
    p => new Date(p.payment_date) >= startOfMonth
  );
  const collectedThisMonth = thisMonthPayments.reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0
  );

  // Count unique users who paid this month
  const usersWhoPayedThisMonth = new Set(thisMonthPayments.map(p => p.subscriber_id)).size;

  const paymentGap = expectedMRR - collectedThisMonth;

  // Get all subscribers for the analytics dropdown
  const { data: allSubscribers } = await supabase
    .from('subscribers')
    .select('id, full_name')
    .order('full_name');

  return {
    expectedMRR,
    activeUserCount,
    collectedThisMonth,
    usersWhoPayedThisMonth,
    paymentGap,
    pendingFirstPayment,
    subscribers: allSubscribers || [],
    payments: allPayments || [],
  };
}

export default async function FinancialsPage() {
  const {
    expectedMRR,
    activeUserCount,
    collectedThisMonth,
    usersWhoPayedThisMonth,
    paymentGap,
    pendingFirstPayment,
    subscribers,
    payments,
  } = await getFinancialsData();

  const isOverCollected = paymentGap < 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Financials</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Revenue analytics and payment tracking
        </p>
      </div>

      {/* Two Column Layout - 60/40 split */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-stretch">
        {/* Left Column - Analytics */}
        <FinancialsAnalytics
          subscribers={subscribers}
          payments={payments as Payment[]}
        />

        {/* Right Column - Stats Cards */}
        <div className="flex flex-col gap-4">
          <StatsCard
            title="Expected MRR"
            value={`Rs. ${expectedMRR.toLocaleString()}`}
            subtitle="Estimated monthly revenue"
            icon={TrendingUp}
            tooltip="Calculated as Rs.500 × number of active subscribers. This is a rough estimate assuming each user contributes at least Rs.500/month."
            userCount={activeUserCount}
          />
          <StatsCard
            title="Collected This Month"
            value={`Rs. ${collectedThisMonth.toLocaleString()}`}
            subtitle="Payments this month"
            icon={DollarSign}
            userCount={usersWhoPayedThisMonth}
          />
          <StatsCard
            title="Payment Gap"
            value={`${isOverCollected ? '+' : '-'}Rs. ${Math.abs(paymentGap).toLocaleString()}`}
            subtitle={isOverCollected ? "Over-collected" : "Missing payments"}
            icon={isOverCollected ? TrendingUp : TrendingDown}
            valueClassName={isOverCollected ? "text-green-600" : "text-red-600"}
            iconClassName={isOverCollected ? "text-green-600" : "text-red-600"}
            iconBgClassName={isOverCollected ? "bg-green-50" : "bg-red-50"}
          />
          <StatsCard
            title="Pending First Payment"
            value={pendingFirstPayment}
            subtitle="No payments yet"
            icon={UserPlus}
            href="/subscribers?noPayments=true"
          />
        </div>
      </div>
    </div>
  );
}

