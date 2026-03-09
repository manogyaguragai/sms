'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { NEPALI_MONTHS_SHORT, NEPALI_MONTHS } from '@/lib/nepali-date';
import { formatNepaliDate } from '@/lib/nepali-date';
import type { Payment } from '@/lib/types';

interface PaymentPeriodCalendarProps {
  payments: Payment[];
  frequency?: string[];
  subscriptionEndDates?: Record<string, string>;
  className?: string;
}

interface PaidPeriod {
  month: number;
  year: number;
}

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  '12_hajar': '12 Hajar',
};

export function PaymentPeriodCalendar({
  payments,
  frequency = [],
  subscriptionEndDates = {},
  className = '',
}: PaymentPeriodCalendarProps) {
  const currentNepali = useMemo(() => new NepaliDate(new Date()), []);
  const currentYear = currentNepali.getYear();
  const currentMonth = currentNepali.getMonth();

  const [viewYear, setViewYear] = useState(currentYear);

  const monthsShort = NEPALI_MONTHS_SHORT;

  const paidPeriods = useMemo(() => {
    const periods: PaidPeriod[] = [];
    
    for (const payment of payments) {
      if (payment.notes) {
        const forMatch = payment.notes.match(/(?:Payment\s+)?[Ff]or[:\s]+([^|]+)/);
        if (forMatch) {
          const periodString = forMatch[1].trim();
          const periodParts = periodString.split(',').map(p => p.trim());
          
          for (const part of periodParts) {
            const monthYearMatch = part.match(/([A-Za-z]+)\s+(\d{4})/);
            if (monthYearMatch) {
              const monthName = monthYearMatch[1];
              const year = parseInt(monthYearMatch[2], 10);
              const monthIndex = NEPALI_MONTHS.findIndex(
                m => m.toLowerCase() === monthName.toLowerCase()
              );
              if (monthIndex !== -1 && !isNaN(year)) {
                periods.push({ month: monthIndex, year });
              }
            }
          }
        }
      }

      if (periods.length === 0 && payment.payment_for_period) {
        try {
          const date = new Date(payment.payment_for_period);
          const nepaliDate = new NepaliDate(date);
          periods.push({ month: nepaliDate.getMonth(), year: nepaliDate.getYear() });
        } catch {
          // Skip invalid dates
        }
      }
    }
    
    return periods;
  }, [payments]);

  const isMonthPaid = (monthIndex: number): boolean => {
    return paidPeriods.some(p => p.month === monthIndex && p.year === viewYear);
  };

  const isCurrentMonth = (monthIndex: number) => {
    return viewYear === currentYear && monthIndex === currentMonth;
  };

  const freqsToShow = frequency.length > 0 ? frequency : ['default'];

  return (
    <div className={`rounded-xl bg-white overflow-hidden flex flex-col ${className}`}>
      <div className="p-4 flex flex-col flex-1 justify-between">
        {/* Header with year navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewYear(viewYear - 1)}
            className="h-7 w-7 p-0 hover:bg-slate-100 rounded-lg"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
          </Button>
          <span className="font-semibold text-slate-800 text-sm tracking-tight">{viewYear} B.S.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewYear(viewYear + 1)}
            className="h-7 w-7 p-0 hover:bg-slate-100 rounded-lg"
          >
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </Button>
        </div>

        {/* Per-frequency sections */}
        {freqsToShow.map((freq) => {
          const label = FREQ_LABELS[freq] || freq;
          const endDateStr = subscriptionEndDates[freq];

          return (
            <div key={freq} className="mb-3 last:mb-0">
              {freq !== 'default' && (
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{label}</span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {endDateStr ? `Ends: ${formatNepaliDate(endDateStr, 'short')}` : 'Not started'}
                  </span>
                </div>
              )}

              {/* Month Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {monthsShort.map((month, index) => {
                  const paid = isMonthPaid(index);
                  const isCurrent = isCurrentMonth(index);
                  return (
                    <div
                      key={`${freq}-${month}`}
                      className={`
                        flex items-center justify-center text-xs font-semibold rounded-lg py-2
                        transition-all duration-200
                        ${paid
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300/70 shadow-sm shadow-emerald-100'
                          : 'bg-orange-50/60 text-orange-400/80 border border-orange-200/50'
                        }
                        ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                      `}
                    >
                      {month}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400"></div>
            <span className="text-[10px] text-slate-500 font-medium">Paid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-orange-300"></div>
            <span className="text-[10px] text-slate-500 font-medium">Due</span>
          </div>
        </div>
      </div>
    </div>
  );
}
