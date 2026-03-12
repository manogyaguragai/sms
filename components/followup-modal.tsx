'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRole } from '@/lib/hooks/use-role';
import { createFollowup, searchSubscribersForFollowup, getAllProfiles } from '@/app/actions/followups';
import { NepaliDatePicker } from '@/components/nepali-date-picker';
import { RichTextEditor } from '@/components/rich-text-editor';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, Search, X, ChevronDown, Check, User } from 'lucide-react';
import { toast } from 'sonner';
import NepaliDate from 'nepali-date-converter';

interface FollowupModalProps {
  open: boolean;
  onClose: () => void;
}

interface SubscriberOption {
  id: string;
  master_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface ProfileOption {
  id: string;
  full_name: string | null;
  role: string;
}

export function FollowupModal({ open, onClose }: FollowupModalProps) {
  // Form state
  const [selectedMadeBy, setSelectedMadeBy] = useState<string[]>([]);
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberOption | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [followupDate, setFollowupDate] = useState<Date | null>(new Date());
  const [followupTime, setFollowupTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Profiles for "Made By"
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [madeByOpen, setMadeByOpen] = useState(false);

  // Subscriber search for "Made To"
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberResults, setSubscriberResults] = useState<SubscriberOption[]>([]);
  const [searchingSubscribers, setSearchingSubscribers] = useState(false);
  const [subscriberDropdownOpen, setSubscriberDropdownOpen] = useState(false);

  // Load all profiles when modal opens
  useEffect(() => {
    if (open) {
      setLoadingProfiles(true);
      getAllProfiles()
        .then(setProfiles)
        .finally(() => setLoadingProfiles(false));
    }
  }, [open]);

  // Debounced subscriber search
  useEffect(() => {
    if (!subscriberSearch || subscriberSearch.length < 1) {
      setSubscriberResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingSubscribers(true);
      const results = await searchSubscribersForFollowup(subscriberSearch);
      setSubscriberResults(results);
      setSearchingSubscribers(false);
      setSubscriberDropdownOpen(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [subscriberSearch]);

  // Auto-populate phone when subscriber is selected
  const handleSelectSubscriber = (sub: SubscriberOption) => {
    setSelectedSubscriber(sub);
    setPhoneNumber(sub.phone || '');
    setSubscriberSearch(sub.full_name);
    setSubscriberDropdownOpen(false);
  };

  const handleClearSubscriber = () => {
    setSelectedSubscriber(null);
    setPhoneNumber('');
    setSubscriberSearch('');
    setSubscriberResults([]);
  };

  const toggleMadeBy = (profileId: string) => {
    setSelectedMadeBy((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (selectedMadeBy.length === 0) {
      toast.error('Please select at least one person who made the followup');
      return;
    }
    if (!selectedSubscriber) {
      toast.error('Please select the subscriber the followup was made to');
      return;
    }
    if (!followupDate) {
      toast.error('Please select a date');
      return;
    }

    setSubmitting(true);

    try {
      // Convert date to Nepali date string
      const nepaliDate = new NepaliDate(followupDate);
      const dateStr = `${nepaliDate.getYear()}-${String(nepaliDate.getMonth() + 1).padStart(2, '0')}-${String(nepaliDate.getDate()).padStart(2, '0')}`;

      const result = await createFollowup({
        subscriber_id: selectedSubscriber.id,
        made_by: selectedMadeBy,
        phone_number: phoneNumber || undefined,
        followup_date: dateStr,
        followup_time: followupTime || undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        handleClose();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error('Failed to create followup');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedMadeBy([]);
    setSelectedSubscriber(null);
    setPhoneNumber('');
    setFollowupDate(new Date());
    setFollowupTime('');
    setNotes('');
    setSubscriberSearch('');
    setSubscriberResults([]);
    onClose();
  };

  const getProfileName = (id: string) => {
    const p = profiles.find((p) => p.id === id);
    return p?.full_name && !p.full_name.includes('@') ? p.full_name : 'User';
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="bg-white border-slate-200 max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Record Followup Call</DialogTitle>
          <DialogDescription className="text-slate-500">
            Log a followup call made to a subscriber.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Made By - Multiselect */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Followup Made By <span className="text-red-500">*</span>
            </Label>
            <Popover open={madeByOpen} onOpenChange={setMadeByOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between h-auto min-h-[40px] bg-white border-gray-200 hover:bg-gray-50 text-left"
                >
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedMadeBy.length === 0 ? (
                      <span className="text-gray-400">Select people...</span>
                    ) : (
                      selectedMadeBy.map((id) => (
                        <Badge
                          key={id}
                          className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                        >
                          {getProfileName(id)}
                          <span
                            role="button"
                            className="ml-1 hover:text-blue-900 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMadeBy(id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </Badge>
                      ))
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-2 bg-white border-gray-200 max-h-[240px] overflow-y-auto" align="start">
                {loadingProfiles ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {profiles.map((profile) => (
                      <label
                        key={profile.id}
                        className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedMadeBy.includes(profile.id)}
                          onCheckedChange={() => toggleMadeBy(profile.id)}
                        />
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="text-sm text-gray-700 truncate">
                            {profile.full_name && !profile.full_name.includes('@')
                              ? profile.full_name
                              : 'User'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Made To - Subscriber Search */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Followup Made To <span className="text-red-500">*</span>
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
                    {selectedSubscriber.phone && (
                      <span className="text-xs text-slate-400">{selectedSubscriber.phone}</span>
                    )}
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
                    placeholder="Search by name, phone, master ID, or email..."
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

          {/* Phone Number */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Phone Number</Label>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number"
              className="bg-white border-gray-200 h-10"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Date (Nepali)</Label>
              <NepaliDatePicker
                value={followupDate}
                onChange={setFollowupDate}
                placeholder="Select date"
                className="w-full h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Time</Label>
              <Input
                type="time"
                value={followupTime}
                onChange={(e) => setFollowupTime(e.target.value)}
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
              placeholder="Enter followup notes..."
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
            ) : (
              'Record Followup'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
