'use client';

import { useState, useEffect, useCallback } from 'react';
import { searchSubscribersForEvent, createEvent, updateEvent } from '@/app/actions/events';
import { RichTextEditor } from '@/components/rich-text-editor';
import { NepaliDobPicker } from '@/components/nepali-dob-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import NepaliDate from 'nepali-date-converter';
import type { EventWithDetails } from '@/lib/types';

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  editEvent?: EventWithDetails | null;
}

interface SubscriberOption {
  id: string;
  master_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export function EventModal({ open, onClose, editEvent }: EventModalProps) {
  // Form state
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberOption | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<string>('none');
  const [recurringCount, setRecurringCount] = useState<string>('');
  const [recurringIndefinite, setRecurringIndefinite] = useState(false);
  const [referredBy, setReferredBy] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Date state — default to today's Nepali date
  const [eventDateBs, setEventDateBs] = useState('');

  // Subscriber search
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberResults, setSubscriberResults] = useState<SubscriberOption[]>([]);
  const [searchingSubscribers, setSearchingSubscribers] = useState(false);
  const [subscriberDropdownOpen, setSubscriberDropdownOpen] = useState(false);

  // Initialize form
  useEffect(() => {
    if (open) {
      if (editEvent) {
        setEventName(editEvent.event_name);
        setEventDateBs(editEvent.event_date);
        setEventTime(editEvent.event_time || '');
        setRecurringFrequency(editEvent.recurring_frequency || 'none');
        setRecurringCount(editEvent.recurring_count ? String(editEvent.recurring_count) : '');
        setRecurringIndefinite(editEvent.recurring_indefinite);
        setReferredBy(editEvent.referred_by || '');
        setFormNumber(editEvent.form_number || '');
        setNotes(editEvent.notes || '');
        setSelectedSubscriber({
          id: editEvent.subscribers.id,
          master_id: editEvent.subscribers.master_id,
          full_name: editEvent.subscribers.full_name,
          email: editEvent.subscribers.email,
          phone: editEvent.subscribers.phone,
        });
        setSubscriberSearch(editEvent.subscribers.full_name);
      } else {
        // Default to today's BS date
        try {
          const today = new NepaliDate(new Date());
          const y = today.getYear();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          setEventDateBs(`${y}-${m}-${d}`);
        } catch {
          setEventDateBs('');
        }
      }
    }
  }, [open, editEvent]);

  // Debounced subscriber search
  useEffect(() => {
    if (!subscriberSearch || subscriberSearch.length < 1 || selectedSubscriber) {
      setSubscriberResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingSubscribers(true);
      const results = await searchSubscribersForEvent(subscriberSearch);
      setSubscriberResults(results);
      setSearchingSubscribers(false);
      setSubscriberDropdownOpen(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [subscriberSearch, selectedSubscriber]);

  const handleSelectSubscriber = (sub: SubscriberOption) => {
    setSelectedSubscriber(sub);
    setSubscriberSearch(sub.full_name);
    setSubscriberDropdownOpen(false);
  };

  const handleClearSubscriber = () => {
    setSelectedSubscriber(null);
    setSubscriberSearch('');
    setSubscriberResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedSubscriber) {
      toast.error('Please select who the event is for');
      return;
    }
    if (!eventName.trim()) {
      toast.error('Please enter an event name');
      return;
    }
    if (!eventDateBs) {
      toast.error('Please enter the event date');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        subscriber_id: selectedSubscriber.id,
        event_name: eventName.trim(),
        event_date: eventDateBs,
        event_time: eventTime || undefined,
        recurring_frequency: recurringFrequency !== 'none' ? recurringFrequency : undefined,
        recurring_count: recurringFrequency !== 'none' && !recurringIndefinite && recurringCount
          ? parseInt(recurringCount, 10)
          : undefined,
        recurring_indefinite: recurringFrequency !== 'none' ? recurringIndefinite : undefined,
        notes: notes || undefined,
        referred_by: referredBy || undefined,
        form_number: formNumber || undefined,
      };

      let result;
      if (editEvent) {
        result = await updateEvent(editEvent.id, {
          event_name: payload.event_name,
          event_date: payload.event_date,
          event_time: payload.event_time || '',
          recurring_frequency: payload.recurring_frequency || null,
          recurring_count: payload.recurring_count || null,
          recurring_indefinite: payload.recurring_indefinite || false,
          notes: payload.notes || '',
          referred_by: payload.referred_by || '',
          form_number: payload.form_number || '',
        });
      } else {
        result = await createEvent(payload);
      }

      if (result.success) {
        toast.success(result.message);
        handleClose();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedSubscriber(null);
    setEventName('');
    setEventTime('');
    setEventDateBs('');
    setRecurringFrequency('none');
    setRecurringCount('');
    setRecurringIndefinite(false);
    setReferredBy('');
    setFormNumber('');
    setNotes('');
    setSubscriberSearch('');
    setSubscriberResults([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="bg-white border-slate-200 max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900">
            {editEvent ? 'Edit Event' : 'Record New Event'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {editEvent ? 'Update event details.' : 'Create a new event for a subscriber.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Event For — Subscriber Search */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Event For <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              {selectedSubscriber ? (
                <div className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-md bg-blue-50/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded">
                      {selectedSubscriber.master_id}
                    </span>
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {selectedSubscriber.full_name}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                    onClick={handleClearSubscriber}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={subscriberSearch}
                    onChange={(e) => setSubscriberSearch(e.target.value)}
                    onFocus={() => subscriberResults.length > 0 && setSubscriberDropdownOpen(true)}
                    placeholder="Search by name, phone, master ID..."
                    className="pl-10 bg-white border-gray-200 h-10"
                  />
                  {searchingSubscribers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
              )}

              {/* Subscriber Search Dropdown */}
              {subscriberDropdownOpen && subscriberResults.length > 0 && !selectedSubscriber && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
                  {subscriberResults.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-gray-50 last:border-0"
                      onClick={() => handleSelectSubscriber(sub)}
                    >
                      <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shrink-0">
                        {sub.master_id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{sub.full_name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {[sub.phone, sub.email].filter(Boolean).join(' · ') || 'No contact'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Event Name */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Event Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Renewal Reminder, Meeting..."
              className="bg-white border-gray-200 h-10"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Event Date (BS) <span className="text-red-500">*</span>
              </Label>
              <NepaliDobPicker
                value={eventDateBs || null}
                onChange={setEventDateBs}
                placeholder="Select event date"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Event Time</Label>
              <Input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="bg-white border-gray-200 h-10"
              />
            </div>
          </div>

          {/* Recurring Frequency */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Recurring Frequency</Label>
            <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
              <SelectTrigger className="bg-white border-gray-200 h-10">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            {recurringFrequency !== 'none' && (
              <div className="space-y-3 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="recurring-indefinite"
                    checked={recurringIndefinite}
                    onCheckedChange={(checked) => setRecurringIndefinite(checked as boolean)}
                  />
                  <Label htmlFor="recurring-indefinite" className="text-sm text-slate-600 cursor-pointer">
                    All time (repeats indefinitely)
                  </Label>
                </div>

                {!recurringIndefinite && (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">
                      Number of {recurringFrequency === 'daily' ? 'days' : recurringFrequency === 'weekly' ? 'weeks' : recurringFrequency === 'monthly' ? 'months' : 'years'}
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={recurringCount}
                      onChange={(e) => setRecurringCount(e.target.value)}
                      placeholder={`e.g., ${recurringFrequency === 'daily' ? '30' : recurringFrequency === 'weekly' ? '12' : recurringFrequency === 'monthly' ? '6' : '5'}`}
                      className="bg-white border-gray-200 h-9 w-32"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Referred By & Form Number Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Referred By</Label>
              <Input
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                placeholder="Referrer's name"
                className="bg-white border-gray-200 h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Form Number</Label>
              <Input
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
                placeholder="e.g., F-001"
                className="bg-white border-gray-200 h-10"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Notes</Label>
            <RichTextEditor
              content={notes}
              onChange={setNotes}
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="text-slate-500 border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : editEvent ? (
              'Update Event'
            ) : (
              'Create Event'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
