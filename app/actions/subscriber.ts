'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { logSubscriberDeleted, logSubscriberUpdated, logSubscriberCreated, logPaymentCreated, logPaymentUpdated, logPaymentDeleted } from "@/lib/activity-logger";

export async function updateSubscriptionDate(id: string, newDate: string) {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('subscribers')
      .update({ subscription_end_date: newDate })
      .eq('id', id);

    if (error) throw error;

    // Log the activity
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('full_name')
      .eq('id', id)
      .single();

    if (subscriber) {
      await logSubscriberUpdated(id, subscriber.full_name, { subscription_end_date: newDate });
    }

    revalidatePath(`/subscribers/${id}`);
    revalidatePath('/dashboard');
    return { success: true, message: 'Subscription date updated' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function toggleSubscriberStatus(id: string, newStatus: 'active' | 'inactive') {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('subscribers')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) throw error;

    // Log the activity
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('full_name')
      .eq('id', id)
      .single();

    if (subscriber) {
      await logSubscriberUpdated(id, subscriber.full_name, { status: newStatus });
    }

    revalidatePath(`/subscribers/${id}`);
    revalidatePath('/dashboard');
    return { success: true, message: `Status updated to ${newStatus}` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Delete a subscriber - requires DELETE_SUBSCRIBER permission (super_admin or admin only)
 */
export async function deleteSubscriber(id: string): Promise<{ success: boolean; message: string }> {
  // Check RBAC permission
  const canDelete = await hasPermission('DELETE_SUBSCRIBER');
  if (!canDelete) {
    return { success: false, message: 'Unauthorized: You do not have permission to delete subscribers' };
  }

  const supabase = createAdminClient();

  try {
    // Get subscriber name for logging before deletion
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('full_name')
      .eq('id', id)
      .single();

    if (!subscriber) {
      return { success: false, message: 'Subscriber not found' };
    }

    // Delete the subscriber (payments will cascade delete due to FK)
    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log the deletion
    await logSubscriberDeleted(id, subscriber.full_name);

    revalidatePath('/subscribers');
    revalidatePath('/dashboard');
    return { success: true, message: 'Subscriber deleted successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Update a payment record - requires UPDATE_PAYMENT permission (super_admin or admin only)
 */
export async function updatePayment(
  paymentId: string,
  subscriberId: string,
  updates: {
    amount_paid?: number;
    payment_date?: string;
    notes?: string;
    receipt_number?: string | null;
    payment_mode?: 'online_transfer' | 'physical_transfer' | null;
  }
): Promise<{ success: boolean; message: string }> {
  // Check RBAC permission
  const canUpdate = await hasPermission('UPDATE_PAYMENT');
  if (!canUpdate) {
    return { success: false, message: 'Unauthorized: You do not have permission to edit payments' };
  }

  const supabase = createAdminClient();

  try {
    // Get subscriber name for logging
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('full_name')
      .eq('id', subscriberId)
      .single();

    if (!subscriber) {
      return { success: false, message: 'Subscriber not found' };
    }

    // Update the payment
    const { error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', paymentId);

    if (error) throw error;

    // Log the update
    await logPaymentUpdated(paymentId, subscriber.full_name, updates);

    revalidatePath(`/subscribers/${subscriberId}`);
    revalidatePath('/dashboard');
    revalidatePath('/financials');
    return { success: true, message: 'Payment updated successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Delete a payment record - requires DELETE_PAYMENT permission (super_admin or admin only)
 */
export async function deletePayment(
  paymentId: string,
  subscriberId: string
): Promise<{ success: boolean; message: string }> {
  // Check RBAC permission
  const canDelete = await hasPermission('DELETE_PAYMENT');
  if (!canDelete) {
    return { success: false, message: 'Unauthorized: You do not have permission to delete payments' };
  }

  const supabase = createAdminClient();

  try {
    // Get subscriber name and payment amount for logging
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('full_name')
      .eq('id', subscriberId)
      .single();

    const { data: payment } = await supabase
      .from('payments')
      .select('amount_paid')
      .eq('id', paymentId)
      .single();

    if (!subscriber) {
      return { success: false, message: 'Subscriber not found' };
    }

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    // Delete the payment
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (error) throw error;

    // Log the deletion
    await logPaymentDeleted(paymentId, subscriber.full_name, payment.amount_paid);

    revalidatePath(`/subscribers/${subscriberId}`);
    revalidatePath('/dashboard');
    revalidatePath('/financials');
    return { success: true, message: 'Payment deleted successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Log subscriber creation (called from client components)
 */
export async function logSubscriberCreation(subscriberId: string, subscriberName: string): Promise<void> {
  await logSubscriberCreated(subscriberId, subscriberName);
}

/**
 * Log subscriber update (called from client components)
 */
export async function logSubscriberUpdate(
  subscriberId: string, 
  subscriberName: string, 
  changes: Record<string, unknown>
): Promise<void> {
  await logSubscriberUpdated(subscriberId, subscriberName, changes);
}

/**
 * Log payment creation (called from client components)
 */
export async function logPaymentCreation(
  paymentId: string,
  subscriberName: string,
  amount: number
): Promise<void> {
  await logPaymentCreated(paymentId, subscriberName, amount);
}

/**
 * Log payment update (called from client components)
 */
export async function logPaymentUpdate(
  paymentId: string,
  subscriberName: string,
  changes: Record<string, unknown>
): Promise<void> {
  await logPaymentUpdated(paymentId, subscriberName, changes);
}

