'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Mail, Phone, CalendarClock, Bell, UserPlus, Info } from 'lucide-react';
import { toast } from 'sonner';
import { addMonths, addYears } from 'date-fns';
import type { Subscriber, SubscriberFormData } from '@/lib/types';
import { logSubscriberCreation, logSubscriberUpdate } from '@/app/actions/subscriber';
import { checkPhoneNumberExists, searchSubscribersByName, updateSubscriberFrequencies } from '@/app/actions/subscriber';

interface SubscriberFormProps {
  subscriber?: Subscriber;
  mode: 'create' | 'edit';
}

type SubscriberSuggestion = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  referred_by: string | null;
  reminder_days_before: number;
  frequency: string[];
};

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: '12_hajar', label: '12 Hajar' },
] as const;

export function SubscriberForm({ subscriber, mode }: SubscriberFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SubscriberFormData>({
    full_name: subscriber?.full_name || '',
    email: subscriber?.email || '',
    phone: subscriber?.phone || '',
    frequency: subscriber?.frequency || ['monthly'],
    reminder_days_before: subscriber?.reminder_days_before || 7,
    referred_by: subscriber?.referred_by || '',
  });

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SubscriberSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<string | null>(null);
  const [existingFrequencies, setExistingFrequencies] = useState<string[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced search for name autocomplete (only in create mode)
  const searchNames = useCallback(async (query: string) => {
    if (mode !== 'create' || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchSubscribersByName(query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSearchLoading(false);
    }
  }, [mode]);

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, full_name: value }));
    // Clear the selected subscriber when user edits the name
    if (selectedSubscriberId) {
      setSelectedSubscriberId(null);
      setExistingFrequencies([]);
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      searchNames(value);
    }, 300);
  };

  const handleSuggestionClick = (suggestion: SubscriberSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      full_name: suggestion.full_name,
      email: suggestion.email || '',
      phone: suggestion.phone || '',
      referred_by: suggestion.referred_by || '',
      reminder_days_before: suggestion.reminder_days_before || 7,
      frequency: suggestion.frequency || ['monthly'],
    }));
    setSelectedSubscriberId(suggestion.id);
    setExistingFrequencies(suggestion.frequency || []);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleFrequencyToggle = (freq: string, checked: boolean) => {
    setFormData((prev) => {
      const current = prev.frequency;
      if (checked) {
        return { ...prev, frequency: [...current, freq] };
      } else {
        const filtered = current.filter((f) => f !== freq);
        // Don't allow empty — at least one must be selected
        if (filtered.length === 0) return prev;
        return { ...prev, frequency: filtered };
      }
    });
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Helper: calculate per-frequency end dates
  const calculateEndDates = (frequencies: string[]): Record<string, string> => {
    const now = new Date();
    const endDates: Record<string, string> = {};
    for (const freq of frequencies) {
      if (freq === 'monthly') {
        endDates[freq] = addMonths(now, 1).toISOString();
      } else {
        endDates[freq] = addYears(now, 1).toISOString();
      }
    }
    return endDates;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.frequency.length === 0) {
      toast.error('Please select at least one billing frequency.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'create' && selectedSubscriberId) {
        // UPDATE existing subscriber — add new frequencies
        const newFrequencies = formData.frequency.filter(
          (f) => !existingFrequencies.includes(f)
        );

        if (newFrequencies.length === 0) {
          toast.info('No new frequencies to add — subscriber already has all selected frequencies.');
          setLoading(false);
          return;
        }

        const result = await updateSubscriberFrequencies(selectedSubscriberId, newFrequencies);
        if (!result.success) {
          toast.error(result.message);
          setLoading(false);
          return;
        }

        toast.success(result.message);
        router.push(`/subscribers/${selectedSubscriberId}`);
        router.refresh();
      } else if (mode === 'create') {
      // CREATE new subscriber
        if (formData.phone) {
          const duplicateCheck = await checkPhoneNumberExists(formData.phone.trim());
          if (duplicateCheck.exists) {
            toast.error(
              `Phone number "${formData.phone}" is already used by subscriber "${duplicateCheck.subscriberName}". Please use a different number.`
            );
            setLoading(false);
            return;
          }
        }

        const endDates = calculateEndDates(formData.frequency);
        // Soonest end date
        const allEndDateValues = Object.values(endDates).map((d) => new Date(d).getTime());
        const soonestEndDate = new Date(Math.min(...allEndDateValues)).toISOString();

        const { data, error: insertError } = await supabase.from('subscribers').insert({
          full_name: formData.full_name,
          email: formData.email || null,
          phone: formData.phone || null,
          frequency: formData.frequency,
          reminder_days_before: formData.reminder_days_before,
          subscription_end_date: soonestEndDate,
          subscription_end_dates: endDates,
          status: 'active',
          referred_by: formData.referred_by || null,
        }).select('id').single();

        if (insertError) throw insertError;

        if (data) {
          await logSubscriberCreation(data.id, formData.full_name);
        }

        toast.success('Subscriber added successfully!');
        router.push('/subscribers');
        router.refresh();
      } else if (subscriber) {
        // EDIT existing subscriber
        const endDates = calculateEndDates(formData.frequency);
        const allEndDateValues = Object.values(endDates).map((d) => new Date(d).getTime());
        const soonestEndDate = new Date(Math.min(...allEndDateValues)).toISOString();

        const { error: updateError } = await supabase
          .from('subscribers')
          .update({
            full_name: formData.full_name,
            email: formData.email || null,
            phone: formData.phone || null,
            frequency: formData.frequency,
            reminder_days_before: formData.reminder_days_before,
            referred_by: formData.referred_by || null,
            subscription_end_dates: endDates,
            subscription_end_date: soonestEndDate,
          })
          .eq('id', subscriber.id);

        if (updateError) throw updateError;

        await logSubscriberUpdate(subscriber.id, formData.full_name, {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          frequency: formData.frequency,
        });

        toast.success('Subscriber updated successfully!');
        router.push(`/subscribers/${subscriber.id}`);
        router.refresh();
      }
    } catch (error) {
      console.error('Error saving subscriber:', error);
      toast.error('Failed to save subscriber. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900">
          {mode === 'create'
            ? selectedSubscriberId
              ? 'Update Existing Subscriber'
              : 'Add New Subscriber'
            : 'Edit Subscriber'}
        </CardTitle>
        <CardDescription className="text-gray-500">
          {mode === 'create'
            ? selectedSubscriberId
              ? 'Adding new billing frequency to an existing subscriber.'
              : 'Enter the subscriber details below. The subscription will start immediately.'
            : 'Update the subscriber information below.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name with Autocomplete */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-gray-700">
                Full Name *
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  ref={inputRef}
                  id="full_name"
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0 && mode === 'create') {
                      setShowSuggestions(true);
                    }
                  }}
                  required
                  autoComplete="off"
                  disabled={!!selectedSubscriberId}
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 text-gray-400 animate-spin" />
                )}

                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && mode === 'create' && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                  >
                    <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                      Existing subscribers found — click to prepopulate
                    </div>
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">
                          {suggestion.full_name}
                        </div>
                        <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                          {suggestion.phone && <span>{suggestion.phone}</span>}
                          {suggestion.email && <span>{suggestion.email}</span>}
                          <span className="text-blue-600">
                            {(suggestion.frequency || []).join(', ')}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {mode === 'create' && !selectedSubscriberId && (
                <p className="text-xs text-gray-500">
                  Start typing to search existing subscribers
                </p>
              )}
              {selectedSubscriberId && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Linked to existing subscriber — select new frequencies to add
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubscriberId(null);
                      setExistingFrequencies([]);
                      setFormData((prev) => ({ ...prev, full_name: '', email: '', phone: '', referred_by: '', frequency: ['monthly'] }));
                    }}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  disabled={!!selectedSubscriberId}
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-700">
                Phone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  disabled={!!selectedSubscriberId}
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Referred By */}
            <div className="space-y-2">
              <Label htmlFor="referred_by" className="text-gray-700">
                Referred By
              </Label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="referred_by"
                  type="text"
                  placeholder="Referrer's name (optional)"
                  value={formData.referred_by}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, referred_by: e.target.value }))
                  }
                  disabled={!!selectedSubscriberId}
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                Name of the person who referred this subscriber
              </p>
            </div>

            {/* Frequency — Multi-select Checkboxes */}
            <div className="space-y-2">
              <Label className="text-gray-700 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-gray-400" />
                Billing Frequency *
              </Label>
              <div className="flex flex-col gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                {FREQUENCY_OPTIONS.map((opt) => {
                  const isChecked = formData.frequency.includes(opt.value);
                  const isExisting = existingFrequencies.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 cursor-pointer ${isExisting && selectedSubscriberId ? 'opacity-60' : ''
                        }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked: boolean) =>
                          handleFrequencyToggle(opt.value, checked === true)
                        }
                        disabled={isExisting && !!selectedSubscriberId}
                      />
                      <span className="text-sm text-gray-900">{opt.label}</span>
                      {isExisting && selectedSubscriberId && (
                        <span className="text-xs text-gray-400">(already active)</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {selectedSubscriberId && (
                <p className="text-xs text-gray-500">
                  Only new frequencies can be added for existing subscribers
                </p>
              )}
            </div>

            {/* Reminder Days */}
            <div className="space-y-2">
              <Label htmlFor="reminder_days_before" className="text-gray-700">
                Reminder Days Before Expiry
              </Label>
              <div className="relative">
                <Bell className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="reminder_days_before"
                  type="number"
                  min="1"
                  max="30"
                  placeholder="7"
                  value={formData.reminder_days_before}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reminder_days_before: parseInt(e.target.value) || 7,
                    }))
                  }
                  disabled={!!selectedSubscriberId}
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <p className="text-xs text-gray-500">
                Number of days before subscription ends to send a reminder email
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {selectedSubscriberId ? 'Updating...' : mode === 'create' ? 'Adding...' : 'Saving...'}
                </>
              ) : selectedSubscriberId ? (
                'Update Subscriber'
              ) : mode === 'create' ? (
                'Add Subscriber'
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
