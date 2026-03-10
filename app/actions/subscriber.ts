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
 * Check if a receipt number already exists in any payment record.
 * Optionally exclude a specific payment ID (useful for edit flows).
 */
export async function checkReceiptNumberExists(
  receiptNumber: string,
  excludePaymentId?: string
): Promise<{ exists: boolean; subscriberName?: string }> {
  const supabase = createAdminClient();

  let query = supabase
    .from('payments')
    .select('id, subscriber_id')
    .eq('receipt_number', receiptNumber);

  if (excludePaymentId) {
    query = query.neq('id', excludePaymentId);
  }

  const { data, error } = await query.limit(1);

  if (error || !data || data.length === 0) {
    return { exists: false };
  }

  // Get subscriber name for the warning message
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('full_name')
    .eq('id', data[0].subscriber_id)
    .single();

  return {
    exists: true,
    subscriberName: subscriber?.full_name || 'Unknown',
  };
}

/**
 * Check if a phone number already exists for any subscriber.
 * Optionally exclude a specific subscriber ID (useful for edit flows).
 */
export async function checkPhoneNumberExists(
  phone: string,
  excludeSubscriberId?: string
): Promise<{ exists: boolean; subscriberName?: string }> {
  const supabase = createAdminClient();

  let query = supabase
    .from('subscribers')
    .select('id, full_name')
    .eq('phone', phone);

  if (excludeSubscriberId) {
    query = query.neq('id', excludeSubscriberId);
  }

  const { data, error } = await query.limit(1);

  if (error || !data || data.length === 0) {
    return { exists: false };
  }

  return {
    exists: true,
    subscriberName: data[0].full_name || 'Unknown',
  };
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
    proof_url?: string | null;
    payment_for?: string | null;
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

    // Check for duplicate receipt number before updating
    if (updates.receipt_number) {
      const duplicateCheck = await checkReceiptNumberExists(updates.receipt_number, paymentId);
      if (duplicateCheck.exists) {
        return {
          success: false,
          message: `Receipt number "${updates.receipt_number}" already exists for subscriber ${duplicateCheck.subscriberName}. Please use a unique receipt number.`,
        };
      }
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

/**
 * Search subscribers by name for autocomplete.
 * Returns up to 5 matching subscribers with fields needed for prepopulation.
 */
export async function searchSubscribersByName(
  query: string
): Promise<{
  id: string;
  master_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  referred_by: string | null;
  reminder_days_before: number;
  frequency: string[];
}[]> {
  if (!query || query.trim().length < 2) return [];

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('subscribers')
    .select('id, master_id, full_name, email, phone, referred_by, reminder_days_before, frequency')
    .ilike('full_name', `%${query.trim()}%`)
    .limit(5);

  if (error || !data) return [];
  return data;
}

/**
 * Update an existing subscriber's frequencies by merging new ones.
 * Calculates per-frequency end dates and sets subscription_end_date to soonest.
 */
export async function updateSubscriberFrequencies(
  subscriberId: string,
  newFrequencies: string[]
): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();

  try {
    // Fetch current subscriber data
    const { data: subscriber, error: fetchError } = await supabase
      .from('subscribers')
      .select('frequency, subscription_end_dates, full_name')
      .eq('id', subscriberId)
      .single();

    if (fetchError || !subscriber) {
      return { success: false, message: 'Subscriber not found' };
    }

    // Merge frequencies (deduplicate)
    const existingFreqs: string[] = subscriber.frequency || [];
    const mergedFreqs = [...new Set([...existingFreqs, ...newFrequencies])];

    // Do NOT create end dates for new frequencies — they will be set when payments are recorded
    const { error: updateError } = await supabase
      .from('subscribers')
      .update({
        frequency: mergedFreqs,
        status: 'active',
      })
      .eq('id', subscriberId);

    if (updateError) throw updateError;

    await logSubscriberUpdated(subscriberId, subscriber.full_name, {
      frequency: mergedFreqs,
    });

    revalidatePath(`/subscribers/${subscriberId}`);
    revalidatePath('/subscribers');
    revalidatePath('/dashboard');
    return { success: true, message: `Frequencies updated for ${subscriber.full_name}` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Update a subscriber's Nepali name and phone fields.
 * Called from the ID card modal when the user edits Devanagari text.
 */
export async function updateNepaliFields(
  subscriberId: string,
  nepaliName: string,
  nepaliPhone: string | null
): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('subscribers')
      .update({
        nepali_name: nepaliName,
        nepali_phone: nepaliPhone,
      })
      .eq('id', subscriberId);

    if (error) throw error;

    revalidatePath(`/subscribers/${subscriberId}`);
    return { success: true, message: 'Nepali details updated' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
