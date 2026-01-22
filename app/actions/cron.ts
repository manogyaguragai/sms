'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminReminderEmail, sendInactiveSubscriberEmail } from "@/lib/resend";
import { sendAdminReminderSMS, sendInactiveSubscriberSMS } from "@/lib/notification";
import { differenceInDays, startOfDay, format } from "date-fns";

interface InactiveSubscriberInfo {
  name: string;
  email: string;
  subscriptionEndDate: string;
  daysOverdue: number;
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

    // Normalize to start of day for accurate day comparison
    const today = startOfDay(new Date());
    
    // Collect subscribers whose subscription is ending within their reminder window
    const subscribersNeedingReminder = [];

    for (const subscriber of subscribers) {
      const endDate = startOfDay(new Date(subscriber.subscription_end_date));
      const daysUntilExpiry = differenceInDays(endDate, today);

      // Check if days until expiry matches the subscriber's reminder setting
      if (daysUntilExpiry === subscriber.reminder_days_before) {
        subscribersNeedingReminder.push({
          name: subscriber.full_name,
          email: subscriber.email,
          daysUntilExpiry,
          subscriptionEndDate: subscriber.subscription_end_date,
          monthlyRate: subscriber.monthly_rate || 0,
        });
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

    const today = startOfDay(new Date());
    const subscribersToDeactivate: InactiveSubscriberInfo[] = [];
    const subscriberIdsToUpdate: string[] = [];

    for (const subscriber of subscribers) {
      const endDate = startOfDay(new Date(subscriber.subscription_end_date));
      const daysOverdue = differenceInDays(today, endDate);

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

    if (subscribersToDeactivate.length === 0) {
      return { 
        success: true, 
        message: 'No expired subscriptions beyond grace period.',
        inactiveCount: 0,
      };
    }

    // Update all expired subscribers to inactive status with a note
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

    // Send admin notifications
    const emailResult = await sendInactiveSubscriberEmail({
      subscribers: subscribersToDeactivate,
    });

    const smsResult = await sendInactiveSubscriberSMS({
      subscribers: subscribersToDeactivate,
    });

    return {
      success: true,
      message: `${subscribersToDeactivate.length} subscriber(s) marked inactive.`,
      inactiveCount: subscribersToDeactivate.length,
      emailSent: emailResult.success,
      smsSent: smsResult.success,
      subscribers: subscribersToDeactivate.map(s => s.name),
    };

  } catch (error: any) {
    console.error('Check expired subscriptions error:', error);
    return { success: false, message: error.message || 'Internal server error' };
  }
}
