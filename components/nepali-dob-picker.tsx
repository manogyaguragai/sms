'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar, ChevronLeft } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';

interface NepaliDobPickerProps {
  value: string | null; // YYYY-MM-DD in BS
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

const MIN_YEAR = 2070;
const MAX_YEAR = 2100;
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

function getDaysInNepaliMonth(year: number, month: number): number {
  try {
    for (let day = 32; day >= 29; day--) {
      try {
        new NepaliDate(year, month, day);
        return day;
      } catch {
        continue;
      }
    }
    return 30;
  } catch {
    return 30;
  }
}

function getCurrentBSYear(): number {
  try {
    return new NepaliDate(new Date()).getYear();
  } catch {
    return 2081;
  }
}

type PickerStep = 'year' | 'month' | 'day';

export function NepaliDobPicker({
  value,
  onChange,
  placeholder = 'Select date of birth',
  className,
}: NepaliDobPickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PickerStep>('year');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  // Parse existing value
  const parsedValue = (() => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-indexed month
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m, day: d };
    }
    return null;
  })();

  const displayValue = parsedValue
    ? `${NEPALI_MONTHS[parsedValue.month]} ${parsedValue.day}, ${parsedValue.year}`
    : placeholder;

  // When popover opens, reset to year step
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setStep('year');
      setSelectedYear(parsedValue?.year ?? null);
      setSelectedMonth(parsedValue?.month ?? null);
    }
  };

  // Scroll to the current BS year when opening year picker
  useEffect(() => {
    if (open && step === 'year' && yearListRef.current) {
      // Use multiple rAF + timeout to ensure DOM is fully painted
      // (Radix popover inside a dialog can delay rendering)
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!yearListRef.current) return;
            const activeBtn = yearListRef.current.querySelector('[data-active="true"]') as HTMLElement;
            if (activeBtn) {
              activeBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
          });
        });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [open, step]);

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setStep('month');
  };

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month);
    setStep('day');
  };

  const handleDaySelect = (day: number) => {
    if (selectedYear === null || selectedMonth === null) return;
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${selectedYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const daysInMonth =
    selectedYear !== null && selectedMonth !== null
      ? getDaysInNepaliMonth(selectedYear, selectedMonth)
      : 32;

  const stepTitle = step === 'year' ? 'Select Year' : step === 'month' ? 'Select Month' : 'Select Day';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`justify-start text-left font-normal bg-gray-50 border-gray-200 hover:bg-gray-100 h-9 ${
            value ? 'text-gray-900' : 'text-gray-400'
          } ${className || ''}`}
        >
          <Calendar className="mr-2 h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="truncate">{displayValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-white border-gray-200 shadow-lg" align="start" side="bottom" sideOffset={4}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          {step !== 'year' && (
            <button
              type="button"
              onClick={() => setStep(step === 'day' ? 'month' : 'year')}
              className="p-1 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm font-semibold text-gray-700">
            {step === 'year'
              ? stepTitle
              : step === 'month'
              ? `${selectedYear} — Select Month`
              : `${NEPALI_MONTHS[selectedMonth!]} ${selectedYear} — Select Day`}
          </span>
        </div>

        {/* Year Selection — Box Grid */}
        {step === 'year' && (
          <div
            ref={yearListRef}
            className="p-3"
            style={{ maxHeight: 260, overflowY: 'auto' }}
          >
            <div className="grid grid-cols-4 gap-1.5">
              {YEARS.map((year) => {
                const isCurrent = year === (selectedYear ?? getCurrentBSYear());
                return (
                  <button
                    key={year}
                    type="button"
                    data-active={isCurrent ? 'true' : undefined}
                    onClick={() => handleYearSelect(year)}
                    className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Month Selection */}
        {step === 'month' && (
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {NEPALI_MONTHS.map((month, idx) => (
              <button
                key={month}
                type="button"
                onClick={() => handleMonthSelect(idx)}
                className={`px-2 py-2 text-sm rounded-lg font-medium transition-colors ${
                  idx === selectedMonth
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200'
                }`}
              >
                {month}
              </button>
            ))}
          </div>
        )}

        {/* Day Selection */}
        {step === 'day' && (
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`aspect-square w-full flex items-center justify-center text-xs rounded-md font-medium transition-colors ${
                    parsedValue &&
                    parsedValue.year === selectedYear &&
                    parsedValue.month === selectedMonth &&
                    parsedValue.day === day
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-100'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
