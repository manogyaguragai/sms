import { Resend } from 'resend';
import { format } from 'date-fns';

export const resend = new Resend(process.env.RESEND_API_KEY);

/** Format a number with commas (ICU-free) */
function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format a date string to a readable format (ICU-free) */
function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'EEE, MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function formatDateNow(): string {
  return format(new Date(), 'EEEE, MMMM d, yyyy');
}

// Admin email for notifications - defaults to Resend test email
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'delivered@resend.dev';

function freqLabel(freq: string): string {
  switch (freq) {
    case 'monthly': return 'Monthly';
    case 'annually': return 'Annually';
    case '12_hajar': return '12 Hajar';
    default: return freq.charAt(0).toUpperCase() + freq.slice(1);
  }
}

interface SubscriberReminder {
  name: string;
  email: string | null;
  daysUntilExpiry: number;
  subscriptionEndDate: string;
  monthlyRate: number;
  frequency: string;
}

interface AdminReminderEmailProps {
  subscribers: SubscriberReminder[];
}

export async function sendAdminReminderEmail({ subscribers }: AdminReminderEmailProps) {
  if (subscribers.length === 0) {
    return { success: true, message: 'No subscribers to notify about' };
  }

  const subscriberRows = subscribers.map(sub => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">${sub.name}</td>
      <td style="padding: 12px; text-align: left;">${sub.email || 'N/A'}</td>
      <td style="padding: 12px; text-align: center;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#f3f4f6;font-weight:600;">${freqLabel(sub.frequency)}</span></td>
      <td style="padding: 12px; text-align: center;">${sub.daysUntilExpiry} day${sub.daysUntilExpiry === 1 ? '' : 's'}</td>
      <td style="padding: 12px; text-align: left;">${formatDate(sub.subscriptionEndDate)}</td>
      <td style="padding: 12px; text-align: right;">NRS ${formatNumber(sub.monthlyRate || 0)}</td>
    </tr>
  `).join('');

  try {
    const { data, error } = await resend.emails.send({
      from: 'SubTrack <notifications@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `⚠️ Subscription Expiry Alert: ${subscribers.length} subscriber${subscribers.length === 1 ? '' : 's'} expiring soon`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">📋 SubTrack Admin Alert</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1f2937; margin-top: 0;">Subscriptions Expiring Soon</h2>
            <p style="color: #4b5563;">
              The following <strong>${subscribers.length}</strong> subscriber${subscribers.length === 1 ? ' has a' : 's have'} subscription${subscribers.length === 1 ? '' : 's'} expiring soon and may need follow-up:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; margin-top: 16px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Name</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Email</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Subscription</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Days Left</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Expiry Date</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Monthly Rate</th>
                </tr>
              </thead>
              <tbody>
                ${subscriberRows}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>💡 Tip:</strong> Consider reaching out to these subscribers to remind them about renewal.
              </p>
            </div>
          </div>
          
          <div style="padding: 16px; background: #f3f4f6; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
              This is an automated notification from SubTrack Admin System • ${formatDateNow()}
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending admin reminder email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending admin reminder email:', error);
    return { success: false, error };
  }
}

export async function sendTestEmail(to: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'SubTrack <notifications@resend.dev>',
      to: [to],
      subject: 'Test Email from SubTrack',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Test Email</h2>
          <p>This is a test email from your SubTrack Admin System.</p>
          <p>If you are receiving this, your email configuration is working correctly.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">Sent via Resend</p>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending test email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, error };
  }
}

interface InactiveSubscriberInfo {
  name: string;
  email: string | null;
  subscriptionEndDate: string;
  daysOverdue: number;
  frequency: string;
}

interface InactiveSubscribersEmailProps {
  subscribers: InactiveSubscriberInfo[];
}

export async function sendInactiveSubscriberEmail({ subscribers }: InactiveSubscribersEmailProps) {
  if (subscribers.length === 0) {
    return { success: true, message: 'No subscribers to notify about' };
  }

  const subscriberRows = subscribers.map(sub => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">${sub.name}</td>
      <td style="padding: 12px; text-align: left;">${sub.email || 'N/A'}</td>
      <td style="padding: 12px; text-align: center;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#fef2f2;font-weight:600;color:#991b1b;">${freqLabel(sub.frequency)}</span></td>
      <td style="padding: 12px; text-align: left;">${formatDate(sub.subscriptionEndDate)}</td>
      <td style="padding: 12px; text-align: center; color: #dc2626;">${sub.daysOverdue} day${sub.daysOverdue === 1 ? '' : 's'}</td>
    </tr>
  `).join('');

  try {
    const { data, error } = await resend.emails.send({
      from: 'SubTrack <notifications@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `🚫 Status Change Alert: ${subscribers.length} subscriber${subscribers.length === 1 ? '' : 's'} marked inactive`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626, #991b1b); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">🚫 SubTrack Status Alert</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1f2937; margin-top: 0;">Subscribers Marked Inactive</h2>
            <p style="color: #4b5563;">
              The following <strong>${subscribers.length}</strong> subscriber${subscribers.length === 1 ? ' has' : 's have'} been automatically marked as <span style="color: #dc2626; font-weight: bold;">inactive</span> due to subscription expiry with no payment after a 3-day grace period:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; margin-top: 16px;">
              <thead>
                <tr style="background: #fef2f2;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Name</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Email</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Subscription</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Expired On</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Overdue</th>
                </tr>
              </thead>
              <tbody>
                ${subscriberRows}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; padding: 16px; background: #fee2e2; border-radius: 8px; border-left: 4px solid #dc2626;">
              <p style="margin: 0; color: #991b1b; font-size: 14px;">
                <strong>⚠️ Action Required:</strong> These subscribers have been marked inactive. You may want to contact them about renewing their subscription.
              </p>
            </div>
          </div>
          
          <div style="padding: 16px; background: #f3f4f6; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
              This is an automated notification from SubTrack Admin System • ${formatDateNow()}
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending inactive subscriber email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending inactive subscriber email:', error);
    return { success: false, error };
  }
}

