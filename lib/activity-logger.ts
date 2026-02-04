'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionType } from '@/lib/types';

interface LogActivityOptions {
  userId?: string | null;
  actionType: ActionType;
  description: string;
  metadata?: Record<string, unknown>;
  targetTable?: string;
  targetId?: string;
}

/**
 * Log an activity to the activity_logs table
 */
export async function logActivity(options: LogActivityOptions): Promise<void> {
  const {
    userId,
    actionType,
    description,
    metadata = {},
    targetTable,
    targetId,
  } = options;

  // Use admin client to bypass RLS for logging
  const supabase = createAdminClient();

  try {
    // If userId not provided, try to get current user
    let finalUserId = userId;
    if (finalUserId === undefined) {
      const serverSupabase = await createClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      finalUserId = user?.id ?? null;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: finalUserId,
      action_type: actionType,
      description,
      metadata,
      target_table: targetTable,
      target_id: targetId,
    });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error in logActivity:', error);
  }
}

/**
 * Log a communication event (email/SMS)
 */
export async function logCommunication(
  type: 'email' | 'sms',
  recipient: string,
  subject: string,
  body: string,
  status: 'sent' | 'failed',
  providerResponse?: Record<string, unknown>
): Promise<void> {
  const actionType: ActionType = type === 'email' ? 'EMAIL_SENT' : 'SMS_SENT';

  await logActivity({
    actionType,
    description: `${type.toUpperCase()} ${status} to ${recipient}`,
    metadata: {
      type,
      recipient,
      subject,
      body,
      status,
      provider_response: providerResponse,
    },
  });
}

/**
 * Log a user login event
 */
export async function logLogin(userId: string, email: string): Promise<void> {
  await logActivity({
    userId,
    actionType: 'USER_LOGIN',
    description: `User logged in: ${email}`,
    metadata: { email },
  });
}

/**
 * Log a user logout event
 */
export async function logLogout(userId: string, email: string): Promise<void> {
  await logActivity({
    userId,
    actionType: 'USER_LOGOUT',
    description: `User logged out: ${email}`,
    metadata: { email },
  });
}

/**
 * Log subscriber creation
 */
export async function logSubscriberCreated(
  subscriberId: string,
  subscriberName: string
): Promise<void> {
  await logActivity({
    actionType: 'SUBSCRIBER_CREATED',
    description: `Created subscriber: ${subscriberName}`,
    targetTable: 'subscribers',
    targetId: subscriberId,
    metadata: { subscriber_name: subscriberName },
  });
}

/**
 * Log subscriber update
 */
export async function logSubscriberUpdated(
  subscriberId: string,
  subscriberName: string,
  changes: Record<string, unknown>
): Promise<void> {
  await logActivity({
    actionType: 'SUBSCRIBER_UPDATED',
    description: `Updated subscriber: ${subscriberName}`,
    targetTable: 'subscribers',
    targetId: subscriberId,
    metadata: { subscriber_name: subscriberName, changes },
  });
}

/**
 * Log subscriber deletion
 */
export async function logSubscriberDeleted(
  subscriberId: string,
  subscriberName: string
): Promise<void> {
  await logActivity({
    actionType: 'SUBSCRIBER_DELETED',
    description: `Deleted subscriber: ${subscriberName}`,
    targetTable: 'subscribers',
    targetId: subscriberId,
    metadata: { subscriber_name: subscriberName },
  });
}

/**
 * Log payment creation
 */
export async function logPaymentCreated(
  paymentId: string,
  subscriberName: string,
  amount: number
): Promise<void> {
  await logActivity({
    actionType: 'PAYMENT_CREATED',
    description: `Recorded payment of NRS ${amount} for ${subscriberName}`,
    targetTable: 'payments',
    targetId: paymentId,
    metadata: { subscriber_name: subscriberName, amount },
  });
}

/**
 * Log payment deletion
 */
export async function logPaymentDeleted(
  paymentId: string,
  subscriberName: string,
  amount: number
): Promise<void> {
  await logActivity({
    actionType: 'PAYMENT_DELETED',
    description: `Deleted payment of NRS ${amount} for ${subscriberName}`,
    targetTable: 'payments',
    targetId: paymentId,
    metadata: { subscriber_name: subscriberName, amount },
  });
}

/**
 * Log payment update
 */
export async function logPaymentUpdated(
  paymentId: string,
  subscriberName: string,
  changes: Record<string, unknown>
): Promise<void> {
  await logActivity({
    actionType: 'PAYMENT_UPDATED',
    description: `Updated payment for ${subscriberName}`,
    targetTable: 'payments',
    targetId: paymentId,
    metadata: { subscriber_name: subscriberName, changes },
  });
}

/**
 * Log data export
 */
export async function logDataExported(
  exportType: 'subscribers' | 'payments' | 'both'
): Promise<void> {
  await logActivity({
    actionType: 'DATA_EXPORTED',
    description: `Exported ${exportType} data as CSV`,
    metadata: { export_type: exportType },
  });
}

/**
 * Log cron job trigger
 */
export async function logCronTriggered(
  emailsSent: number,
  smsSent: number = 0
): Promise<void> {
  await logActivity({
    actionType: 'CRON_TRIGGERED',
    description: `Reminder cron executed: ${emailsSent} emails, ${smsSent} SMS sent`,
    metadata: { emails_sent: emailsSent, sms_sent: smsSent },
  });
}

/**
 * Log user creation
 */
export async function logUserCreated(
  newUserId: string,
  email: string,
  role: string
): Promise<void> {
  await logActivity({
    actionType: 'USER_CREATED',
    description: `Created ${role} user: ${email}`,
    targetTable: 'profiles',
    targetId: newUserId,
    metadata: { email, role },
  });
}

/**
 * Log user deletion
 */
export async function logUserDeleted(
  deletedUserId: string,
  email: string,
  role: string
): Promise<void> {
  await logActivity({
    actionType: 'USER_DELETED',
    description: `Deleted ${role} user: ${email}`,
    targetTable: 'profiles',
    targetId: deletedUserId,
    metadata: { email, role },
  });
}

