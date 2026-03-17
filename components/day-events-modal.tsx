'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Repeat, Cake } from 'lucide-react';
import type { CalendarEvent } from '@/lib/types';

const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

interface DayEventsModalProps {
  open: boolean;
  onClose: () => void;
  date: string; // "YYYY-MM-DD" BS
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function DayEventsModal({ open, onClose, date, events, onEventClick }: DayEventsModalProps) {
  let dateLabel = date;
  try {
    const [y, m, d] = date.split('-').map(Number);
    dateLabel = `${NEPALI_MONTHS[m - 1]} ${d}, ${y}`;
  } catch {}

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-white border-slate-200 max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {dateLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {events.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No events on this day</p>
          )}
          {events.map((ev) => (
            <button
              key={ev.id}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
              onClick={() => {
                onEventClick(ev);
                onClose();
              }}
            >
              <div className="flex items-start gap-2">
                {ev.is_birthday ? (
                  <Cake className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                ) : ev.is_recurring ? (
                  <Repeat className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-700">
                    {ev.event_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{ev.subscriber_name}</span>
                    {ev.event_time && (
                      <span className="text-xs text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {ev.event_time}
                      </span>
                    )}
                  </div>
                </div>
                {ev.is_birthday && (
                  <Badge className="bg-pink-50 text-pink-600 border-pink-200 text-[10px] shrink-0">Birthday</Badge>
                )}
                {ev.is_recurring && !ev.is_birthday && (
                  <Badge className="bg-purple-50 text-purple-600 border-purple-200 text-[10px] shrink-0">Recurring</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
