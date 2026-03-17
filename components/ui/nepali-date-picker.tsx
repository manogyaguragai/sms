'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import NepaliDate from 'nepali-date-converter';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { NEPALI_MONTHS } from '@/lib/nepali-date';

interface NepaliDatePickerProps {
  value: string; // YYYY-MM-DD format (English date)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Days in each month for Nepali calendar (varies by year, this is approximate)
const getDaysInNepaliMonth = (year: number, month: number): number => {
  try {
    const nepaliDate = new NepaliDate(year, month, 1);
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
    return 30; // Default fallback
  }
};

export function NepaliDatePicker({ value, onChange, placeholder = 'Select date', className }: NepaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'year' | 'month' | 'date'>('year');
  const yearContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Convert English date to Nepali for display
  const currentNepaliDate = useMemo(() => {
    if (!value) return null;
    try {
      const jsDate = new Date(value);
      if (isNaN(jsDate.getTime())) return null;
      return new NepaliDate(jsDate);
    } catch {
      return null;
    }
  }, [value]);

  // Current viewing month/year (Nepali)
  const [viewYear, setViewYear] = useState(() => {
    if (currentNepaliDate) return currentNepaliDate.getYear();
    return new NepaliDate(new Date()).getYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (currentNepaliDate) return currentNepaliDate.getMonth();
    return new NepaliDate(new Date()).getMonth();
  });

  // Update view when value changes
  useEffect(() => {
    if (currentNepaliDate) {
      setViewYear(currentNepaliDate.getYear());
      setViewMonth(currentNepaliDate.getMonth());
    }
  }, [currentNepaliDate]);

  // Scroll to selected year when year view opens
  useEffect(() => {
    if (step === 'year' && open && yearContainerRef.current) {
      // Use a longer timeout to ensure the popover DOM has fully rendered
      const timer = setTimeout(() => {
        const container = yearContainerRef.current;
        if (!container) return;
        const selectedYearEl = container.querySelector('[data-selected="true"]');
        if (selectedYearEl) {
          selectedYearEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step, open]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Start flow at year
      setStep('year');
      if (currentNepaliDate) {
        setViewYear(currentNepaliDate.getYear());
        setViewMonth(currentNepaliDate.getMonth());
      } else {
        const today = new NepaliDate(new Date());
        setViewYear(today.getYear());
        setViewMonth(today.getMonth());
      }
    }
  };

  // Get days in current viewing month
  const daysInMonth = useMemo(() => getDaysInNepaliMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  // Get first day of month (0 = Sunday)
  const getFirstDayOfMonth = () => {
    try {
      const firstDay = new NepaliDate(viewYear, viewMonth, 1);
      return firstDay.toJsDate().getDay();
    } catch {
      return 0;
    }
  };

  // Handle date selection
  const handleDateSelect = (day: number) => {
    try {
      const nepaliDate = new NepaliDate(viewYear, viewMonth, day);
      const jsDate = nepaliDate.toJsDate();
      // Convert to YYYY-MM-DD format
      // Need to adjust for timezone offset to ensure local date is accurate before iso string taking it to UTC
      const localDate = new Date(jsDate.getTime() - jsDate.getTimezoneOffset() * 60000);
      const isoDate = localDate.toISOString().split('T')[0];
      onChange(isoDate);
      setOpen(false);
    } catch (error) {
      console.error('Error selecting date:', error);
    }
  };

  // Navigation
  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Format display value
  const displayValue = useMemo(() => {
    if (!mounted || !currentNepaliDate) return '';
    const year = currentNepaliDate.getYear();
    const month = currentNepaliDate.getMonth();
    const day = currentNepaliDate.getDate();
    return `${NEPALI_MONTHS[month]} ${day}, ${year}`;
  }, [currentNepaliDate, mounted]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = getFirstDayOfMonth();
    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  }, [viewYear, viewMonth, daysInMonth]);

  // Get selected day for highlighting
  const selectedDay = currentNepaliDate && 
    currentNepaliDate.getYear() === viewYear && 
    currentNepaliDate.getMonth() === viewMonth 
      ? currentNepaliDate.getDate() 
      : null;

  // Check if a day is today
  const isToday = (day: number) => {
    const today = new NepaliDate(new Date());
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getYear() === viewYear
    );
  };

  // Year Options
  const yearOptions = Array.from({ length: 100 }, (_, i) => 2000 + i);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${!value ? 'text-muted-foreground' : ''} ${className}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayValue || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 bg-white" align="start">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div className="font-semibold text-gray-900 flex gap-1 items-center">
              <button 
                onClick={() => setStep('year')} 
                className={`px-2 py-1 rounded-md transition-colors ${step === 'year' ? 'bg-gray-100 text-blue-600' : 'hover:bg-gray-50'}`}
              >
                {viewYear}
              </button>
              <span className="text-gray-300">/</span>
              <button 
                onClick={() => setStep('month')}
                className={`px-2 py-1 rounded-md transition-colors ${step === 'month' ? 'bg-gray-100 text-blue-600' : 'hover:bg-gray-50'}`}
              >
                {NEPALI_MONTHS[viewMonth]}
              </button>
            </div>
            {step === 'date' && (
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={goToPrevMonth} className="h-7 w-7 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={goToNextMonth} className="h-7 w-7 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Body */}
          {step === 'year' && (
            <div 
              ref={yearContainerRef}
              className="grid grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full"
            >
              {yearOptions.map(y => (
                <button
                  key={y}
                  data-selected={y === viewYear ? 'true' : 'false'}
                  onClick={() => { setViewYear(y); setStep('month'); }}
                  className={`py-2 text-sm rounded transition-colors ${
                    y === viewYear 
                      ? 'bg-blue-600 text-white' 
                      : (currentNepaliDate && y === currentNepaliDate.getYear())
                        ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200' 
                        : 'hover:bg-gray-100 text-gray-900 border border-transparent'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {step === 'month' && (
            <div className="grid grid-cols-3 gap-2">
              {NEPALI_MONTHS.map((m, i) => (
                <button
                  key={m}
                  data-selected={i === viewMonth}
                  onClick={() => { setViewMonth(i); setStep('date'); }}
                  className={`py-3 text-sm rounded transition-colors ${
                    i === viewMonth 
                      ? 'bg-blue-600 text-white' 
                      : (currentNepaliDate && i === currentNepaliDate.getMonth() && viewYear === currentNepaliDate.getYear())
                        ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200' 
                        : 'hover:bg-gray-100 text-gray-900 border border-transparent'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {step === 'date' && (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, i) => (
                  <div key={i} className="text-center text-xs font-medium text-gray-500 w-8 h-8 flex items-center justify-center">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <div key={index} className="w-8 h-8">
                    {day !== null && (
                      <Button
                        variant={day === selectedDay ? 'default' : 'ghost'}
                        size="sm"
                        className={`w-full h-full p-0 text-sm ${
                          day === selectedDay 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : isToday(day)
                              ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                              : 'hover:bg-gray-100 text-gray-900 border border-transparent'
                        }`}
                        onClick={() => handleDateSelect(day)}
                      >
                        {day}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Today button */}
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const today = new Date();
                    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
                    const isoDate = localDate.toISOString().split('T')[0];
                    onChange(isoDate);
                    setOpen(false);
                  }}
                >
                  Today
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
