import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DollarSign, Users, AlertTriangle, Receipt, Calendar, ArrowRight } from 'lucide-react';
import { format, differenceInDays, addDays, startOfDay } from 'date-fns';
import Link from 'next/link';
import type { Subscriber, PaymentWithSubscriber } from '@/lib/types';
import { DashboardCharts } from '@/components/dashboard-charts';

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
    .order('subscription_end_date', { ascending: true })
    .limit(10);

  // Get recent payments with subscriber info
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('*, subscribers(full_name, email)')
    .order('payment_date', { ascending: false })
    .limit(10);

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

  const chartData = {
    payments: (recentPayments || [])
      .slice(0, 7)
      .reverse()
      .map(p => ({
        date: format(new Date(p.payment_date), 'MMM d'),
        amount: Number(p.amount_paid),
        name: p.subscribers?.full_name || 'Unknown'
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
  };
}

export default async function DashboardPage() {
  const { mrr, totalSubscribers, expiringSoon, recentPayments, chartData } = await getDashboardData();

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
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
        />
        <StatsCard
          title="Active Subscribers"
          value={totalSubscribers}
          subtitle="Currently active"
          icon={Users}
        />
        <StatsCard
          title="Expiring Soon"
          value={expiringSoon.length}
          subtitle="Within next 10 days"
          icon={AlertTriangle}
        />
        <StatsCard
          title="Recent Payments"
          value={recentPayments.length}
          subtitle="Last 10 transactions"
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
          <CardContent className="space-y-3">
            {expiringSoon.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                No subscriptions expiring soon
              </p>
            ) : (
              expiringSoon.map((sub) => {
                const daysLeft = differenceInDays(
                  startOfDay(new Date(sub.subscription_end_date)),
                  startOfDay(new Date())
                );
                return (
                  <Link
                    key={sub.id}
                    href={`/subscribers/${sub.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9 bg-amber-500">
                        <AvatarFallback className="bg-transparent text-white text-sm">
                          {sub.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {sub.full_name}
                        </p>
                        <p className="text-xs text-gray-500">{sub.email}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${
                        daysLeft <= 3
                          ? 'border-red-200 text-red-600 bg-red-50'
                          : 'border-amber-200 text-amber-600 bg-amber-50'
                      }`}
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      {daysLeft} days
                    </Badge>
                  </Link>
                );
              })
            )}
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
          <CardContent className="space-y-3">
            {recentPayments.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                No payments recorded yet
              </p>
            ) : (
              recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9 bg-green-500">
                      <AvatarFallback className="bg-transparent text-white text-sm">
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
                        {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">
                      +Rs. {Number(payment.amount_paid).toFixed(2)}
                    </p>
                    {payment.proof_url && (
                      <a
                        href={payment.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        View proof
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
