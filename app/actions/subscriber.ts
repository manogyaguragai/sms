'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { logSubscriberDeleted, logSubscriberUpdated, logSubscriberCreated, logPaymentCreated } from "@/lib/activity-logger";

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
