'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';

interface NepaliDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  className?: string;
}

const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const getDaysInNepaliMonth = (year: number, month: number): number => {
  try {
    let maxDays = 32;
    for (let day = 32; day >= 29; day--) {
      try {
        new NepaliDate(year, month, day);
        maxDays = day;
        break;
      } catch {
        continue;
      }
    }
    return maxDays;
  } catch {
    return 30;
  }
};

export function NepaliDatePicker({ value, onChange, placeholder = 'Select date', className }: NepaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const currentNepali = useMemo(() => {
    try {
      return value ? new NepaliDate(value) : new NepaliDate(new Date());
    } catch {
      return new NepaliDate(new Date());
    }
  }, [value]);

  const [viewYear, setViewYear] = useState(currentNepali.getYear());
  const [viewMonth, setViewMonth] = useState(currentNepali.getMonth());

  // Sync view when value changes
  useEffect(() => {
    if (value) {
      try {
        const nd = new NepaliDate(value);
        setViewYear(nd.getYear());
        setViewMonth(nd.getMonth());
      } catch {}
    }
  }, [value]);

  const daysInMonth = useMemo(() => getDaysInNepaliMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  const startDayOfWeek = useMemo(() => {
    try {
      return new NepaliDate(viewYear, viewMonth, 1).toJsDate().getDay();
    } catch {
      return 0;
    }
  }, [viewYear, viewMonth]);

  const handleDayClick = (day: number) => {
    try {
      const jsDate = new NepaliDate(viewYear, viewMonth, day).toJsDate();
      onChange(jsDate);
      setOpen(false);
    } catch (error) {
      console.error('Error selecting date:', error);
    }
  };

  const goToPreviousMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else { setViewMonth(m => m - 1); }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else { setViewMonth(m => m + 1); }
  };

  const displayValue = useMemo(() => {
    if (!mounted || !value) return placeholder;
    try {
      const nd = new NepaliDate(value);
      return `${NEPALI_MONTHS[nd.getMonth()]} ${nd.getDate()}, ${nd.getYear()}`;
    } catch {
      return placeholder;
    }
  }, [value, mounted, placeholder]);

  const isSelectedDay = (day: number) => {
    if (!value) return false;
    return (
      currentNepali.getDate() === day &&
      currentNepali.getMonth() === viewMonth &&
      currentNepali.getYear() === viewYear
    );
  };

  const isToday = (day: number) => {
    const today = new NepaliDate(new Date());
    return today.getDate() === day && today.getMonth() === viewMonth && today.getYear() === viewYear;
  };

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [startDayOfWeek, daysInMonth]);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`justify-start text-left font-normal bg-white border-gray-200 hover:bg-gray-50 h-9 ${
            value ? 'text-gray-900' : 'text-gray-400'
          } ${className || ''}`}
        >
          <Calendar className="mr-2 h-3.5 w-3.5 text-gray-400" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white border-gray-200 shadow-lg" align="start">
        <div className="p-3">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button type="button" variant="ghost" size="sm" onClick={goToPreviousMonth} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-900">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-gray-900 text-sm">
              {NEPALI_MONTHS[viewMonth]} {viewYear}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={goToNextMonth} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-900">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-[10px] font-medium text-gray-400 py-1 w-8">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, index) => (
              <div key={index} className="w-8 h-8">
                {day !== null ? (
                  <button
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`w-full h-full rounded text-xs font-medium transition-colors ${
                      isSelectedDay(day)
                        ? 'bg-blue-600 text-white'
                        : isToday(day)
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
