'use client';

import { useState, useEffect, useCallback } from 'react';
import { getEventsForList, getEventById } from '@/app/actions/events';
import { EventDetailModal } from '@/components/event-detail-modal';
import { EventModal } from '@/components/event-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Repeat,
  Pencil,
  Eye,
} from 'lucide-react';
import type { CalendarEvent, EventWithDetails } from '@/lib/types';

const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

function formatEventDate(bsDate: string): string {
  const parts = bsDate.split('-');
  if (parts.length !== 3) return bsDate;
  const [y, m, d] = parts.map(Number);
  const monthName = NEPALI_MONTHS[m - 1] || '';
  return `${monthName} ${d}, ${y}`;
}

interface EventsListViewProps {
  canEditEvent: boolean;
  canDeleteEvent: boolean;
  onRefreshCalendar?: () => void;
}

export function EventsListView({
  canEditEvent,
  canDeleteEvent,
  onRefreshCalendar,
}: EventsListViewProps) {
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedFullEvent, setSelectedFullEvent] = useState<EventWithDetails | null>(null);
  // Edit modal
  const [editEvent, setEditEvent] = useState<EventWithDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getEventsForList({
        page,
        pageSize,
        search: debouncedSearch || undefined,
      });
      setEvents(result.events);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalPages = Math.ceil(total / pageSize);
  const startItem = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, total);

  const handleEventClick = async (event: EventWithDetails) => {
    const calEv: CalendarEvent = {
      id: event.id,
      event_name: event.event_name,
      event_date: event.event_date,
      event_time: event.event_time,
      subscriber_name: event.subscribers.full_name,
      subscriber_id: event.subscriber_id,
      is_birthday: false,
      is_recurring: !!event.recurring_frequency,
      notes: event.notes,
      referred_by: event.referred_by,
      form_number: event.form_number,
    };
    setSelectedEvent(calEv);
    setSelectedFullEvent(event);
  };

  const handleEdit = (event: EventWithDetails) => {
    setSelectedEvent(null);
    setSelectedFullEvent(null);
    setEditEvent(event);
    setShowEditModal(true);
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditEvent(null);
    fetchEvents();
    onRefreshCalendar?.();
  };

  const handleDetailClose = () => {
    setSelectedEvent(null);
    setSelectedFullEvent(null);
  };

  const handleDeleted = () => {
    setSelectedEvent(null);
    setSelectedFullEvent(null);
    fetchEvents();
    onRefreshCalendar?.();
  };

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by event name, subscriber name or ID, referrer, or form number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading && events.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
            {debouncedSearch ? 'No events found matching your search' : 'No events recorded yet'}
          </div>
        ) : (
          events.map((event) => (
            <button
              key={event.id}
              onClick={() => handleEventClick(event)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate">{event.event_name}</h3>
                    {event.recurring_frequency && (
                      <Badge className="bg-purple-50 text-purple-600 border-purple-200 text-[10px] shrink-0">
                        <Repeat className="w-2.5 h-2.5 mr-0.5" />
                        {event.recurring_frequency}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded mr-2">
                      {event.subscribers.master_id}
                    </span>
                    {event.subscribers.full_name}
                  </p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {formatEventDate(event.event_date)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                {event.event_time && (
                  <span className="text-xs text-gray-500">🕐 {event.event_time}</span>
                )}
                {event.referred_by && (
                  <span className="text-xs text-gray-500">Ref: {event.referred_by}</span>
                )}
                {event.form_number && (
                  <Badge variant="outline" className="border-gray-200 text-gray-500 text-[10px]">
                    Form #{event.form_number}
                  </Badge>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-gray-200">
              <TableHead className="text-gray-500">Event Name</TableHead>
              <TableHead className="text-gray-500">Event For</TableHead>
              <TableHead className="text-gray-500">Date (BS)</TableHead>
              <TableHead className="text-gray-500">Time</TableHead>
              <TableHead className="text-gray-500">Recurring</TableHead>
              <TableHead className="text-gray-500">Referred By</TableHead>
              <TableHead className="text-gray-500">Form #</TableHead>
              <TableHead className="text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && events.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {debouncedSearch ? 'No events found matching your search' : 'No events recorded yet'}
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow
                  key={event.id}
                  className="border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {event.event_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shrink-0">
                        {event.subscribers.master_id}
                      </span>
                      <span className="text-sm text-gray-700 truncate max-w-[150px]">
                        {event.subscribers.full_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm whitespace-nowrap">
                    {formatEventDate(event.event_date)}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {event.event_time || '—'}
                  </TableCell>
                  <TableCell>
                    {event.recurring_frequency ? (
                      <Badge className="bg-purple-50 text-purple-600 border-purple-200 text-xs">
                        <Repeat className="w-3 h-3 mr-1" />
                        {event.recurring_frequency}
                        {event.recurring_indefinite ? ' ∞' : event.recurring_count ? ` ×${event.recurring_count}` : ''}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {event.referred_by || '—'}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {event.form_number || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditEvent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(event);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Showing {startItem} to {endItem} of {total} events
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {getPageNumbers().map((pageNum, index) => (
              <Button
                key={index}
                variant={pageNum === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => typeof pageNum === 'number' && setPage(pageNum)}
                disabled={typeof pageNum !== 'number'}
                className={
                  pageNum === page
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                }
              >
                {pageNum}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
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

      {/* Edit Modal */}
      <EventModal
        open={showEditModal}
        onClose={handleEditModalClose}
        editEvent={editEvent}
      />
    </div>
  );
}
