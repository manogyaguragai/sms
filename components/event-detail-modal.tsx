'use client';

import { useState } from 'react';
import { deleteEvent } from '@/app/actions/events';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, Clock, User, Repeat, FileText, Loader2, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { CalendarEvent, EventWithDetails } from '@/lib/types';

const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

function formatBsDateReadable(bs: string): string {
  try {
    const [y, m, d] = bs.split('-').map(Number);
    return `${NEPALI_MONTHS[m - 1]} ${d}, ${y}`;
  } catch {
    return bs;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

interface EventDetailModalProps {
  event: CalendarEvent | null;
  fullEvent?: EventWithDetails | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: (event: EventWithDetails) => void;
  onDeleted?: () => void;
}

export function EventDetailModal({
  event,
  fullEvent,
  open,
  onClose,
  canEdit,
  canDelete,
  onEdit,
  onDeleted,
}: EventDetailModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!event) return null;

  const handleDelete = async () => {
    const eventId = event.source_event_id || event.id;
    if (event.is_birthday || eventId.startsWith('birthday_')) return;

    setDeleting(true);
    try {
      const result = await deleteEvent(eventId);
      if (result.success) {
        toast.success(result.message);
        onDeleted?.();
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  const isEditable = !event.is_birthday && canEdit;
  const isDeletable = !event.is_birthday && canDelete;
  const realEventId = event.source_event_id || event.id;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-white border-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900 flex items-center gap-2">
            {event.is_birthday && <span className="text-xl">🎂</span>}
            {event.event_name}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {event.is_birthday ? 'Birthday Event' : 'Event Details'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Subscriber */}
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Event For</p>
              <Link
                href={`/subscribers/${event.subscriber_id}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {event.subscriber_name}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Date</p>
              <p className="text-sm font-medium text-slate-900">{formatBsDateReadable(event.event_date)}</p>
            </div>
          </div>

          {/* Time */}
          {event.event_time && (
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Time</p>
                <p className="text-sm font-medium text-slate-900">{event.event_time}</p>
              </div>
            </div>
          )}

          {/* Recurring badge */}
          {event.is_recurring && (
            <div className="flex items-start gap-3">
              <Repeat className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Recurring</p>
                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                  Recurring Event
                </Badge>
              </div>
            </div>
          )}

          {/* Referred By */}
          {(fullEvent?.referred_by || event.referred_by) && (
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Referred By</p>
                <p className="text-sm font-medium text-slate-900">{fullEvent?.referred_by || event.referred_by}</p>
              </div>
            </div>
          )}

          {/* Form Number */}
          {(fullEvent?.form_number || event.form_number) && (
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Form Number</p>
                <p className="text-sm font-medium text-slate-900">{fullEvent?.form_number || event.form_number}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Notes</p>
                <div
                  className="text-sm text-slate-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: event.notes }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isDeletable && !event.id.startsWith('birthday_') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-500 border-red-200 hover:bg-red-50 mr-auto"
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this event{event.is_recurring ? ' and all its recurring occurrences' : ''}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-gray-200 text-gray-600">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {isEditable && fullEvent && !event.id.startsWith('birthday_') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => onEdit?.(fullEvent)}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-slate-500 border-slate-200"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
