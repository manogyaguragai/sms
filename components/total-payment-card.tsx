'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import type { Payment } from '@/lib/types';

interface TotalPaymentCardProps {
  payments: Payment[];
  frequencies: string[];
  className?: string;
}

function getFreqLabel(f: string): string {
  switch (f) {
    case 'monthly': return 'Monthly';
    case 'annually': return 'Annually';
    case '12_hajar': return '12 Hajar';
    default: return f;
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-NP');
}

// Color palette for subscription branches
const BRANCH_COLORS: Record<string, { bg: string; text: string; line: string; badge: string }> = {
  monthly: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    line: 'bg-blue-400',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  annually: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    line: 'bg-purple-400',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  '12_hajar': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    line: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  _other: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    line: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

function getColors(key: string) {
  return BRANCH_COLORS[key] || BRANCH_COLORS._other;
}

export function TotalPaymentCard({ payments, frequencies, className = '' }: TotalPaymentCardProps) {
  // Calculate totals per subscription type
  const totalsMap: Record<string, number> = {};
  let grandTotal = 0;

  for (const p of payments) {
    const key = p.payment_for || '_other';
    totalsMap[key] = (totalsMap[key] || 0) + Number(p.amount_paid);
    grandTotal += Number(p.amount_paid);
  }

  // Build branches: one per frequency + untagged if any
  const branches: { key: string; label: string; amount: number }[] = [];
  for (const freq of frequencies) {
    if (totalsMap[freq] !== undefined) {
      branches.push({ key: freq, label: getFreqLabel(freq), amount: totalsMap[freq] });
    }
  }
  if (totalsMap._other) {
    branches.push({ key: '_other', label: 'Other', amount: totalsMap._other });
  }

  if (payments.length === 0) {
    return (
      <Card className={`bg-white border-gray-200 shadow-sm ${className}`}>
        <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center h-full min-h-[120px]">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No payments yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border-gray-200 shadow-sm ${className}`}>
      <CardContent className="p-4 sm:p-5">
        {/* Total Amount - Top Node */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 shadow-sm">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-emerald-600 font-medium leading-none mb-0.5">
                Total Paid
              </p>
              <p className="text-lg sm:text-xl font-bold text-emerald-700 leading-none">
                Rs. {formatAmount(grandTotal)}
              </p>
            </div>
          </div>

          {/* Vertical connector from total to branches */}
          {branches.length > 0 && (
            <div className="w-0.5 h-4 bg-gray-300" />
          )}

          {/* Branches */}
          {branches.length > 0 && (
            <div className="relative w-full">
              {/* Horizontal connector line spanning all branches */}
              {branches.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-gray-300"
                  style={{
                    left: `${100 / (branches.length * 2)}%`,
                    right: `${100 / (branches.length * 2)}%`,
                  }}
                />
              )}

              <div className={`grid gap-2 ${
                branches.length === 1 ? 'grid-cols-1' : 
                branches.length === 2 ? 'grid-cols-2' : 
                'grid-cols-2 sm:grid-cols-3'
              }`}>
                {branches.map((branch) => {
                  const colors = getColors(branch.key);
                  return (
                    <div key={branch.key} className="flex flex-col items-center">
                      {/* Vertical connector down to branch card */}
                      <div className={`w-0.5 h-3 ${colors.line}`} />

                      {/* Branch card */}
                      <div
                        className={`${colors.bg} border ${colors.badge.split(' ').find(c => c.startsWith('border-'))} 
                          rounded-lg px-3 py-2 text-center w-full transition-transform hover:scale-[1.02]`}
                      >
                        <p className={`text-[10px] sm:text-[11px] uppercase tracking-wide font-medium ${colors.text} leading-none mb-1`}>
                          {branch.label}
                        </p>
                        <p className={`text-sm sm:text-base font-bold ${colors.text} leading-none`}>
                          Rs. {formatAmount(branch.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
