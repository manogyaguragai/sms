'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminReminderEmail } from "@/lib/resend";
import { sendAdminReminderSMS } from "@/lib/notification";
import { differenceInDays, startOfDay } from "date-fns";

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

