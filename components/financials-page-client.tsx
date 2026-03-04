'use client';

import { useState } from 'react';
import { StatsCard } from '@/components/stats-card';
import { FinancialsAnalytics } from '@/components/financials-analytics';
import { DollarSign, TrendingUp, TrendingDown, UserPlus } from 'lucide-react';
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

interface FinancialsPageClientProps {
  stats: Record<SubscriptionType, SegmentedStats>;
  subscribers: { id: string; full_name: string }[];
  payments: Payment[];
}

const TOGGLE_OPTIONS: { value: SubscriptionType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'regular', label: 'Regular' },
  { value: '12_hajar', label: '12 Hajar' },
];

export function FinancialsPageClient({ stats, subscribers, payments }: FinancialsPageClientProps) {
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('all');

  const currentStats = stats[subscriptionType];
  const isOverCollected = currentStats.paymentGap < 0;

  const mrrTooltip = subscriptionType === 'all'
    ? 'Sum of Rs.500 × regular subscribers + Rs.12,000 × 12 Hajar subscribers.'
    : subscriptionType === 'regular'
    ? 'Calculated as Rs.500 × number of active regular (monthly/annual) subscribers.'
    : 'Calculated as Rs.12,000 × number of active 12 Hajar subscribers.';

  return (
    <>
      {/* Subscription Type Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500">Subscription Type:</span>
        <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {TOGGLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                subscriptionType === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setSubscriptionType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout - 60/40 split */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-stretch">
        {/* Left Column - Analytics */}
        <FinancialsAnalytics
          subscribers={subscribers}
          payments={payments}
          subscriptionType={subscriptionType}
        />

        {/* Right Column - Stats Cards */}
        <div className="flex flex-col gap-4">
          <StatsCard
            title="Expected MRR"
            value={`Rs. ${currentStats.expectedMRR.toLocaleString()}`}
            subtitle="Estimated monthly revenue"
            icon={TrendingUp}
            tooltip={mrrTooltip}
            userCount={currentStats.activeUserCount}
          />
          <StatsCard
            title="Collected This Month"
            value={`Rs. ${currentStats.collectedThisMonth.toLocaleString()}`}
            subtitle="Payments this month"
            icon={DollarSign}
            userCount={currentStats.usersWhoPayedThisMonth}
          />
          <StatsCard
            title="Payment Gap"
            value={`${isOverCollected ? '+' : '-'}Rs. ${Math.abs(currentStats.paymentGap).toLocaleString()}`}
            subtitle={isOverCollected ? "Over-collected" : "Missing payments"}
            icon={isOverCollected ? TrendingUp : TrendingDown}
            valueClassName={isOverCollected ? "text-green-600" : "text-red-600"}
            iconClassName={isOverCollected ? "text-green-600" : "text-red-600"}
            iconBgClassName={isOverCollected ? "bg-green-50" : "bg-red-50"}
          />
          <StatsCard
            title="Pending First Payment"
            value={currentStats.pendingFirstPayment}
            subtitle="No payments yet"
            icon={UserPlus}
            href="/subscribers?noPayments=true"
          />
        </div>
      </div>
    </>
  );
}
