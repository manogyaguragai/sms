'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NepaliCalendar } from '@/components/nepali-calendar';
import { EventModal } from '@/components/event-modal';
import { EventDetailModal } from '@/components/event-detail-modal';
import { DayEventsModal } from '@/components/day-events-modal';
import { getEventsForMonth, getEventById } from '@/app/actions/events';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import type { CalendarEvent, EventWithDetails } from '@/lib/types';

const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

interface EventsClientProps {
  initialEvents: CalendarEvent[];
  initialYear: number;
  initialMonth: number; // 0-indexed
  canCreateEvent: boolean;
  canEditEvent: boolean;
  canDeleteEvent: boolean;
}

export function EventsClient({
  initialEvents,
  initialYear,
  initialMonth,
  canCreateEvent,
  canEditEvent,
  canDeleteEvent,
}: EventsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedFullEvent, setSelectedFullEvent] = useState<EventWithDetails | null>(null);
  const [editEvent, setEditEvent] = useState<EventWithDetails | null>(null);
  const [dayExpandDate, setDayExpandDate] = useState<string>('');
  const [dayExpandEvents, setDayExpandEvents] = useState<CalendarEvent[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);

  // Fetch events when month/year changes
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEventsForMonth(viewYear, viewMonth);
      setEvents(data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => {
    // Don't refetch on initial render (we have initialEvents)
    if (viewYear !== initialYear || viewMonth !== initialMonth) {
      fetchEvents();
    }
  }, [viewYear, viewMonth, fetchEvents, initialYear, initialMonth]);

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    try {
      const today = new NepaliDate(new Date());
      setViewYear(today.getYear());
      setViewMonth(today.getMonth());
    } catch {}
  };

  const handleEventClick = async (ev: CalendarEvent) => {
    setSelectedEvent(ev);

    // For non-birthday events, fetch full details for edit capability
    if (!ev.is_birthday) {
      const realId = ev.source_event_id || ev.id;
      try {
        const full = await getEventById(realId);
        setSelectedFullEvent(full);
      } catch {
        setSelectedFullEvent(null);
      }
    } else {
      setSelectedFullEvent(null);
    }
  };

  const handleDayExpand = (date: string, dayEvents: CalendarEvent[]) => {
    setDayExpandDate(date);
    setDayExpandEvents(dayEvents);
    setShowDayModal(true);
  };

  const handleEdit = (event: EventWithDetails) => {
    setSelectedEvent(null);
    setSelectedFullEvent(null);
    setEditEvent(event);
    setShowEventModal(true);
  };

  const handleModalClose = () => {
    setShowEventModal(false);
    setEditEvent(null);
    fetchEvents();
  };

  const handleDetailClose = () => {
    setSelectedEvent(null);
    setSelectedFullEvent(null);
  };

  const handleDeleted = () => {
    setSelectedEvent(null);
    setSelectedFullEvent(null);
    fetchEvents();
  };

  // Generate year options (current ± 10)
  const currentNepaliYear = (() => {
    try { return new NepaliDate(new Date()).getYear(); } catch { return 2082; }
  })();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentNepaliYear - 10 + i);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            Events
          </h1>
          <p className="text-gray-500 mt-1">
            View and manage events on the Nepali calendar
          </p>
        </div>
        {canCreateEvent && (
          <Button
            onClick={() => { setEditEvent(null); setShowEventModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Record New Event
          </Button>
        )}
      </div>

      {/* Month/Year Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
            className="border-gray-200 text-gray-600 hover:bg-gray-100 h-9 w-9 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Select value={String(viewMonth)} onValueChange={(v) => setViewMonth(Number(v))}>
              <SelectTrigger className="bg-white border-gray-200 h-9 w-[130px] text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {NEPALI_MONTHS.map((name, i) => (
                  <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
              <SelectTrigger className="bg-white border-gray-200 h-9 w-[90px] text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 max-h-[240px]">
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
            className="border-gray-200 text-gray-600 hover:bg-gray-100 h-9 w-9 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 h-9 text-sm"
          >
            Today
          </Button>

          {loading && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 ml-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200" />
              Event
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-pink-100 border border-pink-200" />
              Birthday
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-100 border border-purple-200" />
              Recurring
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <NepaliCalendar
        viewYear={viewYear}
        viewMonth={viewMonth}
        events={events}
        onEventClick={handleEventClick}
        onDayExpand={handleDayExpand}
      />

      {/* Event stats */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>{events.filter(e => !e.is_birthday).length} event{events.filter(e => !e.is_birthday).length !== 1 ? 's' : ''}</span>
        <span>{events.filter(e => e.is_birthday).length} birthday{events.filter(e => e.is_birthday).length !== 1 ? 's' : ''}</span>
      </div>

      {/* Modals */}
      <EventModal
        open={showEventModal}
        onClose={handleModalClose}
        editEvent={editEvent}
      />

      <EventDetailModal
        event={selectedEvent}
        fullEvent={selectedFullEvent}
        open={!!selectedEvent}
        onClose={handleDetailClose}
        canEdit={canEditEvent}
        canDelete={canDeleteEvent}
        onEdit={handleEdit}
        onDeleted={handleDeleted}
      />

      <DayEventsModal
        open={showDayModal}
        onClose={() => setShowDayModal(false)}
        date={dayExpandDate}
        events={dayExpandEvents}
        onEventClick={(ev) => {
          handleEventClick(ev);
        }}
      />
    </div>
  );
}
