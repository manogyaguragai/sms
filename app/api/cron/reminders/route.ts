import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminReminderEmail, sendInactiveSubscriberEmail } from '@/lib/resend';
import { sendAdminReminderSMS, sendInactiveSubscriberSMS } from '@/lib/notification';
import { differenceInDays, startOfDay, format } from 'date-fns';

export const runtime = 'edge';

interface SubscriberReminder {
  name: string;
  email: string;
  daysUntilExpiry: number;
  subscriptionEndDate: string;
  monthlyRate: number;
}

interface InactiveSubscriberInfo {
  name: string;
  email: string;
  subscriptionEndDate: string;
  daysOverdue: number;
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

    const today = startOfDay(new Date());
    const subscribersNeedingReminder: SubscriberReminder[] = [];
    const subscribersToDeactivate: InactiveSubscriberInfo[] = [];
    const subscriberIdsToUpdate: string[] = [];

    // Check each subscriber for reminder eligibility and expiry
    for (const subscriber of subscribers) {
      const endDate = startOfDay(new Date(subscriber.subscription_end_date));
      const daysUntilExpiry = differenceInDays(endDate, today);
      const daysOverdue = differenceInDays(today, endDate);

      // Add to reminder list if days until expiry matches the subscriber's reminder setting
      if (daysUntilExpiry === subscriber.reminder_days_before) {
        subscribersNeedingReminder.push({
          name: subscriber.full_name,
          email: subscriber.email,
          daysUntilExpiry,
          subscriptionEndDate: subscriber.subscription_end_date,
          monthlyRate: subscriber.monthly_rate,
        });
      }

      // Check if subscription is expired beyond grace period
      if (daysOverdue > GRACE_PERIOD_DAYS) {
        subscribersToDeactivate.push({
          name: subscriber.full_name,
          email: subscriber.email,
          subscriptionEndDate: subscriber.subscription_end_date,
          daysOverdue,
        });
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
      // Update subscribers to inactive status
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

      // Send inactive notifications
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
      inactiveCount: subscribersToDeactivate.length,
      inactiveEmailSent,
      inactiveSmsSent,
      reminders: subscribersNeedingReminder.map(s => s.name),
      inactiveSubscribers: subscribersToDeactivate.map(s => s.name),
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
