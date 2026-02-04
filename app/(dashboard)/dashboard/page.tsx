import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DollarSign, Users, AlertTriangle, Receipt, ArrowRight } from 'lucide-react';
import { format, addDays } from 'date-fns';
import Link from 'next/link';
import type { Subscriber, PaymentWithSubscriber } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';
import { ExpiringSubscribersList } from '@/components/expiring-subscribers-list';

async function getDashboardData() {
  const supabase = await createClient();

  // Get all active subscribers for MRR calculation
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

  // Get all payments for total revenue calculation
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount_paid');

  // Get recent payments with subscriber info for chart
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('*, subscribers(full_name, email)')
    .order('payment_date', { ascending: false })
    .limit(10);

  // Calculate total revenue
  const totalRevenue = (allPayments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);

  // Calculate MRR and plan distribution
  let mrr = 0;
  const planCounts = { monthly: 0, yearly: 0 };
  if (subscribers) {
    subscribers.forEach((sub: Subscriber) => {
      if (sub.frequency === 'monthly') {
        mrr += Number(sub.monthly_rate);
        planCounts.monthly++;
      } else {
        mrr += Number(sub.monthly_rate) / 12;
        planCounts.yearly++;
      }
    });
  }

  // Aggregate payments by day for chart
  const paymentsByDay = new Map<string, number>();
  (recentPayments || []).forEach(p => {
    const dateKey = format(new Date(p.payment_date), 'MMM d');
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
    mrr,
    totalSubscribers: subscribers?.length || 0,
    expiringSoon: (expiringSoon || []) as Subscriber[],
    recentPayments: (recentPayments || []) as PaymentWithSubscriber[],
    chartData,
    totalRevenue,
  };
}

export default async function DashboardPage() {
  const { mrr, totalSubscribers, expiringSoon, recentPayments, chartData, totalRevenue } = await getDashboardData();

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Monthly Recurring Revenue"
          value={`Rs. ${mrr.toFixed(2)}`}
          subtitle="Based on active subscriptions"
          icon={DollarSign}
          href="/subscribers"
        />
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
          value={`Rs. ${totalRevenue.toFixed(2)}`}
          subtitle="All-time collections"
          icon={Receipt}
        />
      </div>

      {/* Charts */}
      <DashboardCharts paymentData={chartData.payments} planData={chartData.plans} />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Soon */}
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

        {/* Recent Payments */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-500" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPayments.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                No payments recorded yet
              </p>
            ) : (
              recentPayments.slice(0, 10).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7 bg-green-500">
                      <AvatarFallback className="bg-transparent text-white text-xs">
                        {payment.subscribers?.full_name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2) || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {payment.subscribers?.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(payment.payment_date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-green-600">
                    +Rs. {Number(payment.amount_paid).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
