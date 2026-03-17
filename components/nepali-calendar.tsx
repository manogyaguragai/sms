'use client';

import { useMemo } from 'react';
import NepaliDate from 'nepali-date-converter';
import { Cake, Clock, Repeat } from 'lucide-react';
import type { CalendarEvent } from '@/lib/types';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface NepaliCalendarProps {
  viewYear: number;
  viewMonth: number; // 0-indexed
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayExpand: (date: string, events: CalendarEvent[]) => void;
}

function getDaysInNepaliMonth(year: number, month: number): number {
  try {
    for (let day = 32; day >= 29; day--) {
      try {
        new NepaliDate(year, month, day);
        return day;
      } catch { continue; }
    }
    return 30;
  } catch { return 30; }
}

function formatBsDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function NepaliCalendar({ viewYear, viewMonth, events, onEventClick, onDayExpand }: NepaliCalendarProps) {
  const daysInMonth = useMemo(() => getDaysInNepaliMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  const startDayOfWeek = useMemo(() => {
    try {
      return new NepaliDate(viewYear, viewMonth, 1).toJsDate().getDay();
    } catch { return 0; }
  }, [viewYear, viewMonth]);

  // Today in BS
  const todayBs = useMemo(() => {
    try {
      const nd = new NepaliDate(new Date());
      return formatBsDate(nd.getYear(), nd.getMonth(), nd.getDate());
    } catch { return ''; }
  }, []);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.event_date]) map[ev.event_date] = [];
      map[ev.event_date].push(ev);
    }
    // Sort events within each day: birthdays first, then by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (a.is_birthday && !b.is_birthday) return -1;
        if (!a.is_birthday && b.is_birthday) return 1;
        if (a.event_time && b.event_time) return a.event_time.localeCompare(b.event_time);
        if (a.event_time) return -1;
        if (b.event_time) return 1;
        return 0;
      });
    }
    return map;
  }, [events]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [startDayOfWeek, daysInMonth]);

  const MAX_VISIBLE_EVENTS = 2;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEK_DAYS.map((day, i) => (
          <div
            key={day}
            className={`text-center text-xs font-semibold py-3 ${
              i === 6 ? 'text-red-500 bg-red-50/50' : 'text-slate-500 bg-gray-50/50'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[140px] border-b border-r border-gray-100 bg-gray-50/30"
              />
            );
          }

          const dateStr = formatBsDate(viewYear, viewMonth, day);
          const dayEvents = eventsByDate[dateStr] || [];
          const isToday = dateStr === todayBs;
          const isSaturday = (index % 7) === 6;
          const hasMore = dayEvents.length > MAX_VISIBLE_EVENTS;
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const moreCount = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={`day-${day}`}
              className={`min-h-[140px] border-b border-r border-gray-100 p-1.5 transition-colors ${
                isToday
                  ? 'bg-blue-50/60'
                  : isSaturday
                  ? 'bg-red-50/20'
                  : 'hover:bg-gray-50/50'
              }`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : isSaturday
                      ? 'text-red-500'
                      : 'text-slate-700'
                  }`}
                >
                  {day}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {visibleEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={`w-full text-left px-2 py-1.5 rounded-md transition-all ${
                      ev.is_birthday
                        ? 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200'
                        : ev.is_recurring
                        ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                    title={`${ev.event_name} — ${ev.subscriber_name}`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      {ev.is_birthday && <Cake className="w-3 h-3 shrink-0" />}
                      {ev.is_recurring && !ev.is_birthday && <Repeat className="w-3 h-3 shrink-0" />}
                      {ev.event_time && !ev.is_birthday && (
                        <span className="text-[10px] font-medium opacity-80 shrink-0">{ev.event_time}</span>
                      )}
                      <span className="text-xs font-semibold truncate">{ev.event_name}</span>
                    </div>
                    <p className={`text-[10px] truncate ${
                      ev.is_birthday
                        ? 'text-pink-500'
                        : ev.is_recurring
                        ? 'text-purple-500'
                        : 'text-blue-500'
                    }`}>
                      {ev.subscriber_name}
                    </p>
                  </button>
                ))}

                {/* +N more button */}
                {hasMore && (
                  <button
                    onClick={() => onDayExpand(dateStr, dayEvents)}
                    className="w-full text-left px-2 py-1 text-[11px] text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors font-medium"
                  >
                    +{moreCount} more event{moreCount > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
