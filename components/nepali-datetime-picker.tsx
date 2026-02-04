'use client';

import { useState, useMemo, useEffect } from 'react';
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
// Real implementation would need a lookup table for accurate days per month
const getDaysInNepaliMonth = (year: number, month: number): number => {
  // Nepali months have varying days (29-32), using approximation
  // In a production app, use the nepali-date-converter's internal logic
  try {
    const nepaliDate = new NepaliDate(year, month, 1);
    // Try to create a date for day 32, if invalid we know the month has fewer days
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
    // Return placeholder during SSR to avoid hydration mismatch
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
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [startDayOfWeek, daysInMonth]);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`justify-start text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-50 ${className}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white" align="start">
        <div className="p-4">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-gray-900">
              {NEPALI_MONTHS[viewMonth]} {viewYear}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-1"
              >
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
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    {day}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {/* Time picker */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 justify-center">
              <label className="text-sm text-gray-600">Time:</label>
              <Input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={(e) => handleTimeChange(parseInt(e.target.value) || 0, minutes)}
                className="w-16 text-center bg-white border-gray-300"
              />
              <span className="text-gray-600">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes.toString().padStart(2, '0')}
                onChange={(e) => handleTimeChange(hours, parseInt(e.target.value) || 0)}
                className="w-16 text-center bg-white border-gray-300"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
