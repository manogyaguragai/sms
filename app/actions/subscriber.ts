'use server';

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateSubscriptionDate(id: string, newDate: string) {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('subscribers')
      .update({ subscription_end_date: newDate })
      .eq('id', id);

    if (error) throw error;

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

    revalidatePath(`/subscribers/${id}`);
    revalidatePath('/dashboard');
    return { success: true, message: `Status updated to ${newStatus}` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
