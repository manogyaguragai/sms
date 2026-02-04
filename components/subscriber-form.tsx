'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Mail, Phone, CalendarClock, DollarSign, Bell, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { addMonths, addYears } from 'date-fns';
import type { Subscriber, SubscriberFormData } from '@/lib/types';
import { logSubscriberCreation, logSubscriberUpdate } from '@/app/actions/subscriber';

interface SubscriberFormProps {
  subscriber?: Subscriber;
  mode: 'create' | 'edit';
}

export function SubscriberForm({ subscriber, mode }: SubscriberFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SubscriberFormData>({
    full_name: subscriber?.full_name || '',
    email: subscriber?.email || '',
    phone: subscriber?.phone || '',
    frequency: subscriber?.frequency || 'monthly',
    monthly_rate: subscriber?.monthly_rate || 0,
    reminder_days_before: subscriber?.reminder_days_before || 7,
    referred_by: subscriber?.referred_by || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'create') {
        // Calculate subscription end date based on frequency
        const now = new Date();
        const subscriptionEndDate =
          formData.frequency === 'monthly'
            ? addMonths(now, 1)
            : addYears(now, 1);

        const { data, error: insertError } = await supabase.from('subscribers').insert({
          full_name: formData.full_name,
          email: formData.email || null,
          phone: formData.phone || null,
          frequency: formData.frequency,
          monthly_rate: formData.monthly_rate,
          reminder_days_before: formData.reminder_days_before,
          subscription_end_date: subscriptionEndDate.toISOString(),
          status: 'active',
          referred_by: formData.referred_by || null,
        }).select('id').single();

        if (insertError) throw insertError;

        // Log the creation
        if (data) {
          await logSubscriberCreation(data.id, formData.full_name);
        }

        toast.success('Subscriber added successfully!');
        router.push('/subscribers');
      } else if (subscriber) {
        const { error: updateError } = await supabase
          .from('subscribers')
          .update({
            full_name: formData.full_name,
            email: formData.email || null,
            phone: formData.phone || null,
            frequency: formData.frequency,
            monthly_rate: formData.monthly_rate,
            reminder_days_before: formData.reminder_days_before,
            referred_by: formData.referred_by || null,
          })
          .eq('id', subscriber.id);

        if (updateError) throw updateError;

        // Log the update
        await logSubscriberUpdate(subscriber.id, formData.full_name, {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          frequency: formData.frequency,
          monthly_rate: formData.monthly_rate,
        });

        toast.success('Subscriber updated successfully!');
        router.push(`/subscribers/${subscriber.id}`);
      }

      router.refresh();
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
          {mode === 'create' ? 'Add New Subscriber' : 'Edit Subscriber'}
        </CardTitle>
        <CardDescription className="text-gray-500">
          {mode === 'create'
            ? 'Enter the subscriber details below. The subscription will start immediately.'
            : 'Update the subscriber information below.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-gray-700">
                Full Name *
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  required
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
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
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                Name of the person who referred this subscriber
              </p>
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <Label htmlFor="frequency" className="text-gray-700">
                Billing Frequency *
              </Label>
              <div className="relative">
                <CalendarClock className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                <Select
                  value={formData.frequency}
                  onValueChange={(value: 'monthly' | 'annual') =>
                    setFormData((prev) => ({ ...prev, frequency: value }))
                  }
                >
                  <SelectTrigger className="pl-10 bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="monthly" className="text-gray-900 focus:bg-gray-100">
                      Monthly
                    </SelectItem>
                    <SelectItem value="annual" className="text-gray-900 focus:bg-gray-100">
                      Annual
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Monthly Rate */}
            <div className="space-y-2">
              <Label htmlFor="monthly_rate" className="text-gray-700">
                {formData.frequency === 'monthly' ? 'Monthly Rate' : 'Annual Rate'} *
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="monthly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="99.00"
                  value={formData.monthly_rate || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      monthly_rate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  required
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
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
                  {mode === 'create' ? 'Adding...' : 'Saving...'}
                </>
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
