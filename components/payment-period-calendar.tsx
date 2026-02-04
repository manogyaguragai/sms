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
    <div className={`border border-gray-200 rounded-lg bg-white p-3 ${className}`}>
      {/* Compact header with year navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setViewYear(viewYear - 1)}
          className="h-6 w-6 p-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="font-medium text-gray-700 text-xs">{viewYear} B.S.</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setViewYear(viewYear + 1)}
          className="h-6 w-6 p-0"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Month Grid - 4 cols, compact */}
      <div className="grid grid-cols-4 gap-1">
        {monthsShort.map((month, index) => {
          const paid = isMonthPaid(index);
          const isCurrent = isCurrentMonth(index);
          return (
            <div
              key={month}
              className={`
                flex items-center justify-center text-[10px] font-medium rounded border py-1
                ${paid ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-50 text-red-500 border-red-200'}
                ${isCurrent ? 'ring-1 ring-blue-500 ring-offset-1' : ''}
              `}
            >
              {month}
            </div>
          );
        })}
      </div>

      {/* Compact Legend */}
      <div className="flex items-center justify-center gap-3 mt-2 pt-1.5 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-400"></div>
          <span className="text-[9px] text-gray-500">Paid</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-400"></div>
          <span className="text-[9px] text-gray-500">Due</span>
        </div>
      </div>
    </div>
  );
}
