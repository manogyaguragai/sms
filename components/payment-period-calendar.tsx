'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { NEPALI_MONTHS_SHORT, NEPALI_MONTHS } from '@/lib/nepali-date';
import type { Payment } from '@/lib/types';

interface PaymentPeriodCalendarProps {
  payments: Payment[];
  className?: string;
}

interface PaidPeriod {
  month: number;
  year: number;
}

export function PaymentPeriodCalendar({
  payments,
  className = '',
}: PaymentPeriodCalendarProps) {
  // Get current Nepali date
  const currentNepali = useMemo(() => new NepaliDate(new Date()), []);
  const currentYear = currentNepali.getYear();
  const currentMonth = currentNepali.getMonth();

  // Start viewing from current year
  const [viewYear, setViewYear] = useState(currentYear);

  // Nepali months array
  const monthsShort = NEPALI_MONTHS_SHORT;

  // Parse paid periods from payment history
  const paidPeriods = useMemo(() => {
    const periods: PaidPeriod[] = [];
    
    for (const payment of payments) {
      // Try parsing from notes first (e.g., "Payment for: Baisakh 2083" or "Payment for: Magh 2082, Falgun 2082")
      if (payment.notes) {
        // Extract the period string after "for:" or "For:"
        const forMatch = payment.notes.match(/(?:Payment\s+)?[Ff]or[:\s]+([^|]+)/);
        if (forMatch) {
          const periodString = forMatch[1].trim();
          // Split by comma to handle multiple months like "Magh 2082, Falgun 2082"
          const periodParts = periodString.split(',').map(p => p.trim());
          
          for (const part of periodParts) {
            // Match each "MonthName Year" pattern
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
      
      // Also try payment_for_period date if available (only if no periods found from notes)
      // This ensures notes take priority as they contain all selected months
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

  // Check if a month-year is paid
  const isMonthPaid = (monthIndex: number): boolean => {
    return paidPeriods.some(p => p.month === monthIndex && p.year === viewYear);
  };

  const isCurrentMonth = (monthIndex: number) => {
    return viewYear === currentYear && monthIndex === currentMonth;
  };

  return (
    <div className={`rounded-lg bg-white shadow-md overflow-hidden flex flex-col ${className}`}>
      {/* Spiral binding with holes */}
      <div className="bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200 px-2 py-1.5 shrink-0">
        <div className="flex items-center justify-center gap-2">
          {/* Spiral holes - 7 holes */}
          {[...Array(7)].map((_, i) => (
            <div key={i} className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300 border border-gray-400 shadow-inner" />
              {/* Spiral ring effect */}
              <div className="absolute -top-0.5 left-0.5 w-1.5 h-3 border-l-2 border-gray-400 rounded-tl-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1 justify-between">
        {/* Header with year navigation */}
        <div className="flex items-center justify-between mb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewYear(viewYear - 1)}
            className="h-6 w-6 p-0 hover:bg-gray-100"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="font-semibold text-gray-800 text-xs">{viewYear} B.S.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewYear(viewYear + 1)}
            className="h-6 w-6 p-0 hover:bg-gray-100"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Month Grid - 4 cols */}
        <div className="grid grid-cols-4 gap-1 flex-1 content-center">
          {monthsShort.map((month, index) => {
            const paid = isMonthPaid(index);
            const isCurrent = isCurrentMonth(index);
            return (
              <div
                key={month}
                className={`
                  flex items-center justify-center text-[11px] font-medium rounded border py-1.5
                  transition-all duration-150
                  ${paid ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-50 text-red-500 border-red-200'}
                  ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                `}
              >
                {month}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-green-500"></div>
            <span className="text-[9px] text-gray-600 font-medium">Paid</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-red-400"></div>
            <span className="text-[9px] text-gray-600 font-medium">Due</span>
          </div>
        </div>
      </div>
    </div>
  );
}
