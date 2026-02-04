import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/stats-card';
import { DollarSign, TrendingUp, TrendingDown, UserPlus } from 'lucide-react';
import type { Subscriber } from '@/lib/types';

async function getFinancialsData() {
  const supabase = await createClient();

  // Get all active subscribers
  const { data: subscribers } = await supabase
    .from('subscribers')
    .select('*')
    .eq('status', 'active');

  // Get all payments for analytics
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount_paid, subscriber_id, payment_date');

  // Group payments by subscriber
  const paymentsBySubscriber = new Map<string, number[]>();
  (allPayments || []).forEach(p => {
    const existing = paymentsBySubscriber.get(p.subscriber_id) || [];
    existing.push(Number(p.amount_paid));
    paymentsBySubscriber.set(p.subscriber_id, existing);
  });

  // Calculate Expected MRR from payment history
  let expectedMRR = 0;
  let pendingFirstPayment = 0;
  const subscribersWithPayments = new Set(paymentsBySubscriber.keys());

  if (subscribers) {
    subscribers.forEach((sub: Subscriber) => {
      if (subscribersWithPayments.has(sub.id)) {
        const payments = paymentsBySubscriber.get(sub.id) || [];
        const avgPayment = payments.reduce((a, b) => a + b, 0) / payments.length;
        if (sub.frequency === 'monthly') {
          expectedMRR += avgPayment;
        } else {
          expectedMRR += avgPayment / 12;
        }
      } else {
        pendingFirstPayment++;
      }
    });
  }

  // Calculate collected this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const collectedThisMonth = (allPayments || [])
    .filter(p => new Date(p.payment_date) >= startOfMonth)
    .reduce((sum, p) => sum + Number(p.amount_paid), 0);

  const paymentGap = expectedMRR - collectedThisMonth;

  return {
    expectedMRR,
    collectedThisMonth,
    paymentGap,
    pendingFirstPayment,
  };
}

export default async function FinancialsPage() {
  const { expectedMRR, collectedThisMonth, paymentGap, pendingFirstPayment } = await getFinancialsData();
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatsCard
          title="Expected MRR"
          value={`Rs. ${expectedMRR.toFixed(0)}`}
          subtitle="Based on payment history"
          icon={TrendingUp}
        />
        <StatsCard
          title="Collected This Month"
          value={`Rs. ${collectedThisMonth.toFixed(0)}`}
          subtitle="Payments this month"
          icon={DollarSign}
        />
        <StatsCard
          title="Payment Gap"
          value={`${isOverCollected ? '+' : '-'}Rs. ${Math.abs(paymentGap).toFixed(0)}`}
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

      {/* Placeholder for future content */}
      <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
        <p className="text-sm">More financial analytics coming soon...</p>
      </div>
    </div>
  );
}
