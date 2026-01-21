import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendReminderEmail } from '@/lib/resend';
import { differenceInDays, startOfDay } from 'date-fns';

export const runtime = 'edge';

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
        emailsSent: 0,
      });
    }

    const today = new Date();
    const emailResults: Array<{ email: string; success: boolean; error?: string }> = [];

    // Check each subscriber for reminder eligibility
    for (const subscriber of subscribers) {
      const endDate = new Date(subscriber.subscription_end_date);
      const daysUntilExpiry = differenceInDays(startOfDay(endDate), startOfDay(today));

      // Send reminder if days until expiry matches the subscriber's reminder setting
      if (daysUntilExpiry === subscriber.reminder_days_before) {
        const result = await sendReminderEmail({
          to: subscriber.email,
          subscriberName: subscriber.full_name,
          daysUntilExpiry,
          subscriptionEndDate: subscriber.subscription_end_date,
        });

        emailResults.push({
          email: subscriber.email,
          success: result.success,
          error: result.error ? String(result.error) : undefined,
        });

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const successCount = emailResults.filter((r) => r.success).length;
    const failedCount = emailResults.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Reminder check complete`,
      totalSubscribers: subscribers.length,
      emailsSent: successCount,
      emailsFailed: failedCount,
      results: emailResults,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
