'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';

interface NepaliDateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  className?: string;
}

// Nepali month names
const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Days in each month for Nepali calendar (varies by year, this is an approximation)
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

export function NepaliDateTimePicker({ value, onChange, className }: NepaliDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'year' | 'month' | 'date'>('year');
  const yearContainerRef = useRef<HTMLDivElement>(null);
  
  // Prevent hydration mismatch by only rendering dynamic content after mount
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Convert current value to Nepali date
  const currentNepaliDate = useMemo(() => {
    try {
      return new NepaliDate(value);
    } catch {
      return new NepaliDate(new Date());
    }
  }, [value]);
  
  const [viewYear, setViewYear] = useState(currentNepaliDate.getYear());
  const [viewMonth, setViewMonth] = useState(currentNepaliDate.getMonth());
  
  // Time state
  const [hours, setHours] = useState(value.getHours());
  const [minutes, setMinutes] = useState(value.getMinutes());
  
  // Sync time when value changes externally
  useEffect(() => {
    setHours(value.getHours());
    setMinutes(value.getMinutes());
  }, [value]);

  // Scroll to selected year when year view opens
  useEffect(() => {
    if (step === 'year' && open && yearContainerRef.current) {
      // Use requestAnimationFrame + timeout to ensure the popover DOM has fully rendered
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          const container = yearContainerRef.current;
          if (!container) return;
          const selectedYearEl = container.querySelector('[data-selected="true"]');
          if (selectedYearEl) {
            selectedYearEl.scrollIntoView({ block: 'center', behavior: 'instant' });
          }
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step, open]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Start flow at year
      setStep('year');
      setViewYear(currentNepaliDate.getYear());
      setViewMonth(currentNepaliDate.getMonth());
    }
  };

  // Get the days in the current view month
  const daysInMonth = useMemo(() => getDaysInNepaliMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  
  // Get the day of week the month starts on (0 = Sunday)
  const startDayOfWeek = useMemo(() => {
    try {
      const firstDay = new NepaliDate(viewYear, viewMonth, 1);
      return firstDay.toJsDate().getDay();
    } catch {
      return 0;
    }
  }, [viewYear, viewMonth]);

  const handleDayClick = (day: number) => {
    try {
      const nepaliDate = new NepaliDate(viewYear, viewMonth, day);
      const jsDate = nepaliDate.toJsDate();
      // Preserve the time
      jsDate.setHours(hours, minutes, 0, 0);
      onChange(jsDate);
      setOpen(false);
    } catch (error) {
      console.error('Error selecting date:', error);
    }
  };

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    setHours(newHours);
    setMinutes(newMinutes);
    const newDate = new Date(value);
    newDate.setHours(newHours, newMinutes, 0, 0);
    onChange(newDate);
  };

  const goToPreviousMonth = () => {
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
    if (!mounted) {
      return 'Select date...';
    }
    const day = currentNepaliDate.getDate();
    const month = NEPALI_MONTHS[currentNepaliDate.getMonth()];
    const year = currentNepaliDate.getYear();
    const h = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const m = minutes.toString().padStart(2, '0');
    return `${month} ${day}, ${year} ${h}:${m} ${ampm}`;
  }, [currentNepaliDate, hours, minutes, mounted]);

  // Check if a day is the currently selected day
  const isSelectedDay = (day: number) => {
    return (
      currentNepaliDate.getDate() === day &&
      currentNepaliDate.getMonth() === viewMonth &&
      currentNepaliDate.getYear() === viewYear
    );
  };

  // Check if a day is today
  const isToday = (day: number) => {
    const today = new NepaliDate(new Date());
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getYear() === viewYear
    );
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [startDayOfWeek, daysInMonth]);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  // Year range from 2000 to 2099
  const yearOptions = Array.from({ length: 30 }, (_, i) => 2070 + i);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`justify-start text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-50 ${className}`}
        >
          <Calendar className="mr-2 h-4 w-4 text-gray-400" />
          {displayValue}
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
                <Button type="button" variant="ghost" size="sm" onClick={goToPreviousMonth} className="h-7 w-7 p-0">
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
              onWheel={(e) => e.stopPropagation()}
              className="grid grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-2 pb-2 overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full"
              style={{ overscrollBehavior: 'contain' }}
            >
              {yearOptions.map(y => (
                <button
                  key={y}
                  data-selected={y === viewYear ? 'true' : 'false'}
                  onClick={() => { setViewYear(y); setStep('month'); }}
                  className={`py-2 text-sm rounded transition-colors ${
                    y === viewYear 
                      ? 'bg-blue-600 text-white' 
                      : y === currentNepaliDate.getYear() 
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
                      : i === currentNepaliDate.getMonth() && viewYear === currentNepaliDate.getYear() 
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
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <div key={index} className="aspect-square">
                    {day !== null ? (
                      <button
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={`w-full h-full rounded-md text-sm transition-colors ${
                          isSelectedDay(day)
                            ? 'bg-blue-600 text-white'
                            : isToday(day)
                            ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                            : 'hover:bg-gray-100 text-gray-900 border border-transparent'
                        }`}
                      >
                        {day}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Time picker */}
          {step === 'date' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 justify-center">
                <label className="text-sm text-gray-600 font-medium">Time:</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(e) => handleTimeChange(parseInt(e.target.value) || 0, minutes)}
                    className="w-[60px] h-8 text-center bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-blue-500"
                  />
                  <span className="text-gray-400 font-medium">:</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes.toString().padStart(2, '0')}
                    onChange={(e) => handleTimeChange(hours, parseInt(e.target.value) || 0)}
                    className="w-[60px] h-8 text-center bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
