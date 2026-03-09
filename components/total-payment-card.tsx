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

const FREQ_DOT: Record<string, string> = {
  monthly: 'bg-blue-400',
  annually: 'bg-violet-400',
  '12_hajar': 'bg-amber-400',
  _other: 'bg-slate-400',
};

export function TotalPaymentCard({ payments, frequencies, className = '' }: TotalPaymentCardProps) {
  const totalsMap: Record<string, number> = {};
  let grandTotal = 0;

  for (const p of payments) {
    const key = p.payment_for || '_other';
    totalsMap[key] = (totalsMap[key] || 0) + Number(p.amount_paid);
    grandTotal += Number(p.amount_paid);
  }

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
      <Card className={`bg-white ${className}`}>
        <CardContent className="p-5 flex flex-col items-center justify-center min-h-[100px]">
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400 font-medium">No payments yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white overflow-hidden ${className}`}>
      <CardContent className="p-0">
        {/* Grand Total - with colored accent */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/40 p-5 border-b border-emerald-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-emerald-600/70 font-bold mb-0.5">
                Total Collected
              </p>
              <p className="text-xl font-bold text-emerald-700 tracking-tight">
                Rs. {formatAmount(grandTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        {branches.length > 0 && (
          <div className="p-4 space-y-0 divide-y divide-slate-50">
            {branches.map((branch) => (
              <div key={branch.key} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${FREQ_DOT[branch.key] || FREQ_DOT._other}`} />
                  <span className="text-sm text-slate-500 font-medium">{branch.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">Rs. {formatAmount(branch.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
