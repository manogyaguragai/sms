import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminReminderEmail } from '@/lib/resend';
import { differenceInDays, startOfDay } from 'date-fns';

export const runtime = 'edge';

interface SubscriberReminder {
  name: string;
  email: string;
  daysUntilExpiry: number;
  subscriptionEndDate: string;
  monthlyRate: number;
}

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
      });
    }

    const today = new Date();
    const subscribersNeedingReminder: SubscriberReminder[] = [];

    // Check each subscriber for reminder eligibility
    for (const subscriber of subscribers) {
      const endDate = new Date(subscriber.subscription_end_date);
      const daysUntilExpiry = differenceInDays(startOfDay(endDate), startOfDay(today));

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
    }

    // Send a single admin email with all subscribers needing reminders
    if (subscribersNeedingReminder.length > 0) {
      const result = await sendAdminReminderEmail({
        subscribers: subscribersNeedingReminder,
      });

      return NextResponse.json({
        message: 'Reminder check complete',
        totalSubscribers: subscribers.length,
        subscribersNeedingReminder: subscribersNeedingReminder.length,
        emailSent: result.success,
        error: result.error ? String(result.error) : undefined,
        subscribers: subscribersNeedingReminder.map(s => s.name),
      });
    }

    return NextResponse.json({
      message: 'Reminder check complete - no subscribers need reminders today',
      totalSubscribers: subscribers.length,
      subscribersNeedingReminder: 0,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
