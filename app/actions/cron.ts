'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminReminderEmail, sendInactiveSubscriberEmail } from "@/lib/resend";
import { sendAdminReminderSMS, sendInactiveSubscriberSMS } from "@/lib/notification";
import { differenceInDays, startOfDay, format } from "date-fns";

/** Convert a Date to Nepal Standard Time (UTC+5:45) */
function toNepalTime(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + 5 * 3600000 + 45 * 60000);
}

interface InactiveSubscriberInfo {
  name: string;
  email: string;
  subscriptionEndDate: string;
  daysOverdue: number;
  frequency: string;
}

export async function testCronJobAction() {
  try {
    const supabase = createAdminClient();

    // Query all active subscribers
    const { data: subscribers, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('status', 'active');

    if (error) throw new Error(error.message);
    if (!subscribers || subscribers.length === 0) {
      return { success: true, message: 'No active subscribers found', emailsSent: 0, smsSent: false };
    }

    // Use Nepal timezone for accurate day-boundary comparison
    const nowInNepal = toNepalTime(new Date());
    const today = startOfDay(nowInNepal);
    
    // Collect subscribers whose subscription is ending within their reminder window
    const subscribersNeedingReminder: {
      name: string;
      email: string | null;
      daysUntilExpiry: number;
      subscriptionEndDate: string;
      monthlyRate: number;
      frequency: string;
    }[] = [];

    for (const subscriber of subscribers) {
      const endDates: Record<string, string> = subscriber.subscription_end_dates || {};
      const frequencies: string[] = subscriber.frequency || [];

      // Check each frequency's end date independently
      for (const freq of frequencies) {
        const endDateStr = endDates[freq];
        if (!endDateStr) continue;

        // Parse in Nepal timezone so "2026-03-14T18:15:00.000Z" → March 15 NPT (not March 14 UTC)
        const endInNepal = toNepalTime(new Date(endDateStr));
        const endDate = startOfDay(endInNepal);
        const daysUntilExpiry = differenceInDays(endDate, today);

        // Check if days until expiry matches the subscriber's reminder setting
        if (daysUntilExpiry === subscriber.reminder_days_before) {
          subscribersNeedingReminder.push({
            name: subscriber.full_name,
            email: subscriber.email,
            daysUntilExpiry,
            subscriptionEndDate: endDateStr,
            monthlyRate: subscriber.monthly_rate || 0,
            frequency: freq,
          });
        }
      }
    }

    if (subscribersNeedingReminder.length === 0) {
      return { 
        success: true, 
        message: 'Cron job executed successfully. No subscribers due for reminder today.', 
        emailsSent: 0,
        smsSent: false,
      };
    }

    // Send a single email to admin with all subscribers needing reminder
    const emailResult = await sendAdminReminderEmail({
      subscribers: subscribersNeedingReminder,
    });

    // Also send SMS notification to admin
    const smsResult = await sendAdminReminderSMS({
      subscribers: subscribersNeedingReminder,
    });

    if (!emailResult.success) {
      return { 
        success: false, 
        message: `Failed to send admin notification: ${emailResult.error}`,
        emailsSent: 0,
        smsSent: smsResult.success,
      };
    }

    return { 
      success: true, 
      message: `Cron job executed successfully.`, 
      emailsSent: subscribersNeedingReminder.length,
      smsSent: smsResult.success,
    };

  } catch (error: any) {
    console.error('Cron job error:', error);
    return { success: false, message: error.message || 'Internal server error' };
  }
}

// Grace period in days before marking subscriber as inactive
const GRACE_PERIOD_DAYS = 3;

export async function checkExpiredSubscriptions() {
  try {
    const supabase = createAdminClient();

    // Query all active subscribers
    const { data: subscribers, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('status', 'active');

    if (error) throw new Error(error.message);
    if (!subscribers || subscribers.length === 0) {
      return { success: true, message: 'No active subscribers found', inactiveCount: 0 };
    }

    const nowInNepal = toNepalTime(new Date());
    const today = startOfDay(nowInNepal);
    const subscribersToDeactivate: InactiveSubscriberInfo[] = [];
    const subscriberIdsToUpdate: string[] = [];

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
        const daysOverdue = differenceInDays(today, endDate);

        if (daysOverdue > GRACE_PERIOD_DAYS) {
          // This frequency is overdue — add to notification list
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

    if (subscribersToDeactivate.length === 0) {
      return { 
        success: true, 
        message: 'No expired subscriptions beyond grace period.',
        inactiveCount: 0,
      };
    }

    // Update all fully-expired subscribers to inactive status with a note
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

    // Send admin notifications (includes all overdue entries, even partial)
    const emailResult = await sendInactiveSubscriberEmail({
      subscribers: subscribersToDeactivate,
    });

    const smsResult = await sendInactiveSubscriberSMS({
      subscribers: subscribersToDeactivate,
    });

    return {
      success: true,
      message: `${subscriberIdsToUpdate.length} subscriber(s) marked inactive. ${subscribersToDeactivate.length} overdue subscription(s) reported.`,
      inactiveCount: subscriberIdsToUpdate.length,
      emailSent: emailResult.success,
      smsSent: smsResult.success,
      subscribers: subscribersToDeactivate.map(s => `${s.name} (${s.frequency})`),
    };

  } catch (error: any) {
    console.error('Check expired subscriptions error:', error);
    return { success: false, message: error.message || 'Internal server error' };
  }
}
