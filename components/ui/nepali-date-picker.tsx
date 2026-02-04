'use client';

import { useState, useEffect, useMemo } from 'react';
import NepaliDate from 'nepali-date-converter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { NEPALI_MONTHS } from '@/lib/nepali-date';

interface NepaliDatePickerProps {
  value: string; // YYYY-MM-DD format (English date)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Days in each month for Nepali calendar (varies by year, this is approximate)
const NEPALI_DAYS_IN_MONTH = [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31];

export function NepaliDatePicker({ value, onChange, placeholder = 'Select date', className }: NepaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  
  // Convert English date to Nepali for display
  const nepaliDateFromValue = useMemo(() => {
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
    if (nepaliDateFromValue) return nepaliDateFromValue.getYear();
    return new NepaliDate(new Date()).getYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (nepaliDateFromValue) return nepaliDateFromValue.getMonth();
    return new NepaliDate(new Date()).getMonth();
  });

  // Update view when value changes
  useEffect(() => {
    if (nepaliDateFromValue) {
      setViewYear(nepaliDateFromValue.getYear());
      setViewMonth(nepaliDateFromValue.getMonth());
    }
  }, [nepaliDateFromValue]);

  // Get days in current viewing month
  const daysInMonth = NEPALI_DAYS_IN_MONTH[viewMonth] || 30;

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
      const isoDate = jsDate.toISOString().split('T')[0];
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
    if (!nepaliDateFromValue) return '';
    const year = nepaliDateFromValue.getYear();
    const month = nepaliDateFromValue.getMonth();
    const day = nepaliDateFromValue.getDate();
    return `${NEPALI_MONTHS[month]} ${day}, ${year}`;
  }, [nepaliDateFromValue]);

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
  const selectedDay = nepaliDateFromValue && 
    nepaliDateFromValue.getYear() === viewYear && 
    nepaliDateFromValue.getMonth() === viewMonth 
      ? nepaliDateFromValue.getDate() 
      : null;

  // Year options (current year ± 10)
  const currentNepaliYear = new NepaliDate(new Date()).getYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentNepaliYear - 10 + i);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${!value ? 'text-muted-foreground' : ''} ${className}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayValue || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white" align="start">
        <div className="p-3">
          {/* Header with year/month selectors */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-2">
              {/* Month selector */}
              <Select value={String(viewMonth)} onValueChange={(v) => setViewMonth(parseInt(v))}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEPALI_MONTHS.map((month, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Year selector */}
              <Select value={String(viewYear)} onValueChange={(v) => setViewYear(parseInt(v))}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
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
                      day === selectedDay ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-gray-100'
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
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const today = new Date();
                const isoDate = today.toISOString().split('T')[0];
                onChange(isoDate);
                setOpen(false);
              }}
            >
              Today
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
