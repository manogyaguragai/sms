import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertTriangle, Receipt, ArrowRight } from 'lucide-react';
import { addDays } from 'date-fns';
import Link from 'next/link';
import type { Subscriber, PaymentWithSubscriber } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';
import { ExpiringSubscribersList } from '@/components/expiring-subscribers-list';
import { TopSubscribersCard } from '@/components/top-subscribers-card';
import { formatNepaliDate } from '@/lib/nepali-date';

async function getDashboardData() {
  const supabase = await createClient();

  // Get all active subscribers
  const { data: subscribers } = await supabase
    .from('subscribers')
    .select('*')
    .eq('status', 'active');

  // Get expiring soon (next 10 days)
  const tenDaysFromNow = addDays(new Date(), 10).toISOString();
  const { data: expiringSoon } = await supabase
    .from('subscribers')
    .select('*')
    .eq('status', 'active')
    .lte('subscription_end_date', tenDaysFromNow)
    .gte('subscription_end_date', new Date().toISOString())
    .order('subscription_end_date', { ascending: true });

  // Get all payments for analytics
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount_paid, subscriber_id, payment_date');

  // Get recent payments with subscriber info for chart
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('*, subscribers(id, full_name, email)')
    .order('payment_date', { ascending: false })
    .limit(10);

  // Calculate total revenue
  const totalRevenue = (allPayments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);

  // Calculate top subscribers by total payments
  const paymentTotalsBySubscriber = new Map<string, { id: string; full_name: string; totalPaid: number }>();
  (allPayments || []).forEach(p => {
    const existing = paymentTotalsBySubscriber.get(p.subscriber_id);
    if (existing) {
      existing.totalPaid += Number(p.amount_paid);
    } else {
      // We'll need to look up the name from recentPayments or subscribers
      paymentTotalsBySubscriber.set(p.subscriber_id, {
        id: p.subscriber_id,
        full_name: '', // Will be filled below
        totalPaid: Number(p.amount_paid),
      });
    }
  });

  // Get subscriber names for top subscribers
  const { data: allSubscribers } = await supabase
    .from('subscribers')
    .select('id, full_name');

  const subscriberNames = new Map<string, string>();
  (allSubscribers || []).forEach(s => {
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
  const planCounts = { monthly: 0, yearly: 0 };
  if (subscribers) {
    subscribers.forEach((sub: Subscriber) => {
      if (sub.frequency === 'monthly') {
        planCounts.monthly++;
      } else {
        planCounts.yearly++;
      }
    });
  }

  // Aggregate payments by day for chart (using Nepali dates)
  const paymentsByDay = new Map<string, number>();
  (recentPayments || []).forEach(p => {
    const dateKey = formatNepaliDate(new Date(p.payment_date), 'short');
    paymentsByDay.set(dateKey, (paymentsByDay.get(dateKey) || 0) + Number(p.amount_paid));
  });

  const chartData = {
    payments: Array.from(paymentsByDay.entries())
      .slice(0, 7)
      .reverse()
      .map(([date, amount]) => ({
        date,
        amount,
        name: 'Daily Total'
      })),
    plans: [
      { name: 'Monthly', value: planCounts.monthly },
      { name: 'Yearly', value: planCounts.yearly },
    ].filter(i => i.value > 0)
  };

  return {
    totalSubscribers: subscribers?.length || 0,
    expiringSoon: (expiringSoon || []) as Subscriber[],
    recentPayments: (recentPayments || []) as PaymentWithSubscriber[],
    chartData,
    totalRevenue,
    topSubscribers,
  };
}

export default async function DashboardPage() {
  const { totalSubscribers, expiringSoon, chartData, totalRevenue, topSubscribers } = await getDashboardData();

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
          value={totalSubscribers}
          subtitle="Currently active"
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
          value={`Rs. ${totalRevenue.toLocaleString()}`}
          subtitle="All-time collections"
          icon={Receipt}
          href="/financials"
        />
        <TopSubscribersCard subscribers={topSubscribers} />
      </div>

      {/* Charts */}
      <DashboardCharts paymentData={chartData.payments} planData={chartData.plans} />

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
