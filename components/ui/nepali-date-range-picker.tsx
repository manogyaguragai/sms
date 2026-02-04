'use client';

import { useState, useMemo } from 'react';
import NepaliDate from 'nepali-date-converter';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { NEPALI_MONTHS } from '@/lib/nepali-date';

interface DateRange {
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
}

interface NepaliDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

// Days in each month for Nepali calendar (varies by year, this is approximate)
const NEPALI_DAYS_IN_MONTH = [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31];

export function NepaliDateRangePicker({ value, onChange, className }: NepaliDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  
  // Current viewing month/year (Nepali)
  const currentNepaliDate = new NepaliDate(new Date());
  const [viewYear, setViewYear] = useState(currentNepaliDate.getYear());
  const [viewMonth, setViewMonth] = useState(currentNepaliDate.getMonth());

  // Convert dates for display
  const startNepaliDate = useMemo(() => {
    if (!value.startDate) return null;
    try {
      return new NepaliDate(new Date(value.startDate));
    } catch {
      return null;
    }
  }, [value.startDate]);

  const endNepaliDate = useMemo(() => {
    if (!value.endDate) return null;
    try {
      return new NepaliDate(new Date(value.endDate));
    } catch {
      return null;
    }
  }, [value.endDate]);

  // Display value
  const displayValue = useMemo(() => {
    if (!startNepaliDate || !endNepaliDate) return 'Select date range';
    const startStr = `${NEPALI_MONTHS[startNepaliDate.getMonth()]} ${startNepaliDate.getDate()}`;
    const endStr = `${NEPALI_MONTHS[endNepaliDate.getMonth()]} ${endNepaliDate.getDate()}, ${endNepaliDate.getYear()}`;
    return `${startStr} - ${endStr}`;
  }, [startNepaliDate, endNepaliDate]);

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

  // Date selection handlers
  const handleDateSelect = (day: number) => {
    try {
      const nepaliDate = new NepaliDate(viewYear, viewMonth, day);
      const jsDate = nepaliDate.toJsDate();
      const isoDate = jsDate.toISOString().split('T')[0];

      if (!selectingEnd) {
        // Setting start date
        onChange({ startDate: isoDate, endDate: isoDate });
        setSelectingEnd(true);
      } else {
        // Setting end date
        const startJsDate = new Date(value.startDate);
        if (jsDate >= startJsDate) {
          onChange({ ...value, endDate: isoDate });
        } else {
          // If end is before start, swap them
          onChange({ startDate: isoDate, endDate: value.startDate });
        }
        setSelectingEnd(false);
        setOpen(false);
      }
    } catch (error) {
      console.error('Error selecting date:', error);
    }
  };

  // Preset handlers
  const handlePreset = (preset: 'thisMonth' | 'lastMonth' | 'last3Months') => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (preset) {
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last3Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = now;
        break;
    }

    onChange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
    setOpen(false);
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

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = getFirstDayOfMonth();
    const days: (number | null)[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  }, [viewYear, viewMonth, daysInMonth]);

  // Check if a day is in the selected range
  const getDayState = (day: number): 'start' | 'end' | 'range' | 'none' => {
    if (!startNepaliDate || !endNepaliDate) return 'none';
    
    const isStart = startNepaliDate.getYear() === viewYear && 
                    startNepaliDate.getMonth() === viewMonth && 
                    startNepaliDate.getDate() === day;
    const isEnd = endNepaliDate.getYear() === viewYear && 
                  endNepaliDate.getMonth() === viewMonth && 
                  endNepaliDate.getDate() === day;

    if (isStart) return 'start';
    if (isEnd) return 'end';

    // Check if in range
    try {
      const currentDate = new NepaliDate(viewYear, viewMonth, day).toJsDate();
      const start = new Date(value.startDate);
      const end = new Date(value.endDate);
      if (currentDate > start && currentDate < end) return 'range';
    } catch {
      return 'none';
    }

    return 'none';
  };

  // Year options
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentNepaliDate.getYear() - 10 + i);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`justify-start text-left font-normal ${className}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white" align="end">
        {/* Presets */}
        <div className="flex gap-1 p-2 border-b">
          <Button variant="ghost" size="sm" onClick={() => handlePreset('thisMonth')}>
            This Month
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handlePreset('lastMonth')}>
            Last Month
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handlePreset('last3Months')}>
            Last 3 Months
          </Button>
        </div>

        <div className="p-3">
          {/* Selection indicator */}
          <div className="text-center text-sm text-gray-500 mb-2">
            {selectingEnd ? 'Select end date' : 'Select start date'}
          </div>

          {/* Header with year/month selectors */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-2">
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
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={index} className="w-8 h-8" />;
              }

              const state = getDayState(day);
              const isStartOrEnd = state === 'start' || state === 'end';
              const isInRange = state === 'range';

              return (
                <Button
                  key={index}
                  variant={isStartOrEnd ? 'default' : 'ghost'}
                  size="sm"
                  className={`w-8 h-8 p-0 text-sm ${
                    isStartOrEnd ? 'bg-blue-600 text-white hover:bg-blue-700' : 
                    isInRange ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => handleDateSelect(day)}
                >
                  {day}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
