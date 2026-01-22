'use server';

// NotificationAPI SDK for SMS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const notificationapi = require('notificationapi-node-server-sdk').default;

// Initialize NotificationAPI client
const CLIENT_ID = process.env.NOTIFICATIONAPI_CLIENT_ID || '';
const CLIENT_SECRET = process.env.NOTIFICATIONAPI_CLIENT_SECRET || '';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@subtrack.com';

// Initialize only if credentials are available
if (CLIENT_ID && CLIENT_SECRET) {
  notificationapi.init(CLIENT_ID, CLIENT_SECRET);
}

interface SubscriberReminder {
  name: string;
  email: string;
  daysUntilExpiry: number;
  subscriptionEndDate: string;
  monthlyRate: number;
}

interface AdminReminderSMSProps {
  subscribers: SubscriberReminder[];
}

export async function sendAdminReminderSMS({ subscribers }: AdminReminderSMSProps) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('NotificationAPI credentials not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!ADMIN_PHONE) {
    console.error('ADMIN_PHONE not configured');
    return { success: false, error: 'Admin phone number not configured' };
  }

  if (subscribers.length === 0) {
    return { success: true, message: 'No subscribers to notify about' };
  }

  // Format subscriber info for SMS (keeping it concise for SMS)
  const subscriberList = subscribers
    .map(sub => `${sub.name}: ${sub.daysUntilExpiry}d left`)
    .join(', ');

  const message = `📋 SubTrack Alert: ${subscribers.length} subscription${subscribers.length === 1 ? '' : 's'} expiring soon. ${subscriberList}. Check your email for details.`;

  try {
    const result = await notificationapi.send({
      type: 'sms',
      to: {
        id: ADMIN_EMAIL,
        number: ADMIN_PHONE,
      },
      sms: {
        message: message,
      },
    });

    console.log('SMS sent successfully:', result?.data);
    return { success: true, data: result?.data };
  } catch (error) {
    console.error('Error sending admin reminder SMS:', error);
    return { success: false, error: String(error) };
  }
}

export async function sendTestSMS(phoneNumber: string) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('NotificationAPI credentials not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!phoneNumber) {
    return { success: false, error: 'Phone number is required' };
  }

  const message = `✅ SubTrack Test SMS: Your SMS configuration is working correctly! Sent at ${new Date().toLocaleTimeString()}.`;

  try {
    const result = await notificationapi.send({
      type: 'sms',
      to: {
        id: ADMIN_EMAIL,
        number: phoneNumber,
      },
      sms: {
        message: message,
      },
    });

    console.log('Test SMS sent successfully:', result?.data);
    return { success: true, data: result?.data };
  } catch (error) {
    console.error('Error sending test SMS:', error);
    return { success: false, error: String(error) };
  }
}

interface InactiveSubscriberInfo {
  name: string;
  email: string;
  subscriptionEndDate: string;
  daysOverdue: number;
}

interface InactiveSubscriberSMSProps {
  subscribers: InactiveSubscriberInfo[];
}

export async function sendInactiveSubscriberSMS({ subscribers }: InactiveSubscriberSMSProps) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('NotificationAPI credentials not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!ADMIN_PHONE) {
    console.error('ADMIN_PHONE not configured');
    return { success: false, error: 'Admin phone number not configured' };
  }

  if (subscribers.length === 0) {
    return { success: true, message: 'No subscribers to notify about' };
  }

  // Format subscriber info for SMS (keeping it concise for SMS)
  const subscriberList = subscribers
    .map(sub => `${sub.name}: ${sub.daysOverdue}d overdue`)
    .join(', ');

  const message = `🚫 SubTrack Alert: ${subscribers.length} subscriber${subscribers.length === 1 ? '' : 's'} marked INACTIVE due to non-payment. ${subscriberList}. Check email for details.`;

  try {
    const result = await notificationapi.send({
      type: 'sms',
      to: {
        id: ADMIN_EMAIL,
        number: ADMIN_PHONE,
      },
      sms: {
        message: message,
      },
    });

    console.log('Inactive subscriber SMS sent successfully:', result?.data);
    return { success: true, data: result?.data };
  } catch (error) {
    console.error('Error sending inactive subscriber SMS:', error);
    return { success: false, error: String(error) };
  }
}

