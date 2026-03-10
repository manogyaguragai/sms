import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminReminderEmail, sendInactiveSubscriberEmail } from '@/lib/resend';
import { sendAdminReminderSMS, sendInactiveSubscriberSMS } from '@/lib/notification';
import { differenceInDays, startOfDay, format } from 'date-fns';

/** Convert a Date to Nepal Standard Time (UTC+5:45) */
function toNepalTime(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + 5 * 3600000 + 45 * 60000);
}

interface SubscriberReminder {
  name: string;
  email: string;
  daysUntilExpiry: number;
  subscriptionEndDate: string;
  monthlyRate: number;
  frequency: string;
}

interface InactiveSubscriberInfo {
  name: string;
  email: string;
  subscriptionEndDate: string;
  daysOverdue: number;
  frequency: string;
}

// Grace period in days before marking subscriber as inactive
const GRACE_PERIOD_DAYS = 3;

export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // Query all active subscribers
    const { data: subscribers, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching subscribers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscribers' },
        { status: 500 }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({
        message: 'No active subscribers found',
        subscribersNeedingReminder: 0,
        inactiveCount: 0,
      });
    }

    // Use Nepal timezone for accurate day-boundary comparison
    const nowInNepal = toNepalTime(new Date());
    const today = startOfDay(nowInNepal);
    const subscribersNeedingReminder: SubscriberReminder[] = [];
    const subscribersToDeactivate: InactiveSubscriberInfo[] = [];
    const subscriberIdsToUpdate: string[] = [];

    // Check each subscriber's per-frequency end dates
    for (const subscriber of subscribers) {
      const endDates: Record<string, string> = subscriber.subscription_end_dates || {};
      const frequencies: string[] = subscriber.frequency || [];

      // Track whether ALL frequencies are overdue beyond grace period
      let allOverdue = true;
      let hasAnyFrequency = false;

      for (const freq of frequencies) {
        const endDateStr = endDates[freq];
        if (!endDateStr) continue;

        hasAnyFrequency = true;
        // Parse in Nepal timezone so "2026-03-14T18:15:00.000Z" → March 15 NPT (not March 14 UTC)
        const endInNepal = toNepalTime(new Date(endDateStr));
        const endDate = startOfDay(endInNepal);
        const daysUntilExpiry = differenceInDays(endDate, today);
        const daysOverdue = differenceInDays(today, endDate);

        // Add to reminder list if days until expiry matches the subscriber's reminder setting
        if (daysUntilExpiry === subscriber.reminder_days_before) {
          subscribersNeedingReminder.push({
            name: subscriber.full_name,
            email: subscriber.email,
            daysUntilExpiry,
            subscriptionEndDate: endDateStr,
            monthlyRate: subscriber.monthly_rate,
            frequency: freq,
          });
        }

        // Check if this frequency is expired beyond grace period
        if (daysOverdue > GRACE_PERIOD_DAYS) {
          subscribersToDeactivate.push({
            name: subscriber.full_name,
            email: subscriber.email,
            subscriptionEndDate: endDateStr,
            daysOverdue,
            frequency: freq,
          });
        } else {
          // At least one frequency is still within grace period
          allOverdue = false;
        }
      }

      // Only mark subscriber as inactive if ALL frequencies are expired beyond grace
      if (hasAnyFrequency && allOverdue) {
        subscriberIdsToUpdate.push(subscriber.id);
      }
    }

    let reminderEmailSent = false;
    let reminderSmsSent = false;
    let inactiveEmailSent = false;
    let inactiveSmsSent = false;

    // Send reminders if needed
    if (subscribersNeedingReminder.length > 0) {
      const emailResult = await sendAdminReminderEmail({
        subscribers: subscribersNeedingReminder,
      });
      reminderEmailSent = emailResult.success;

      const smsResult = await sendAdminReminderSMS({
        subscribers: subscribersNeedingReminder,
      });
      reminderSmsSent = smsResult.success;
    }

    // Handle expired subscriptions if needed
    if (subscribersToDeactivate.length > 0) {
      // Update subscribers to inactive status (only those with ALL frequencies expired)
      const statusNote = `Marked inactive on ${format(today, 'MMM d, yyyy')} due to subscription expiry without payment (${GRACE_PERIOD_DAYS}-day grace period exceeded)`;
      
      for (const subscriberId of subscriberIdsToUpdate) {
        const { error: updateError } = await supabase
          .from('subscribers')
          .update({
            status: 'inactive',
            status_notes: statusNote,
          })
          .eq('id', subscriberId);

        if (updateError) {
          console.error(`Failed to update subscriber ${subscriberId}:`, updateError);
        }
      }

      // Send inactive notifications (includes all overdue entries)
      const emailResult = await sendInactiveSubscriberEmail({
        subscribers: subscribersToDeactivate,
      });
      inactiveEmailSent = emailResult.success;

      const smsResult = await sendInactiveSubscriberSMS({
        subscribers: subscribersToDeactivate,
      });
      inactiveSmsSent = smsResult.success;
    }

    return NextResponse.json({
      message: 'Cron job complete',
      totalSubscribers: subscribers.length,
      subscribersNeedingReminder: subscribersNeedingReminder.length,
      reminderEmailSent,
      reminderSmsSent,
      inactiveCount: subscriberIdsToUpdate.length,
      inactiveEmailSent,
      inactiveSmsSent,
      reminders: subscribersNeedingReminder.map(s => `${s.name} (${s.frequency})`),
      inactiveSubscribers: subscribersToDeactivate.map(s => `${s.name} (${s.frequency})`),
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
