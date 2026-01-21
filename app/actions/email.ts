'use server';

import { sendTestEmail } from "@/lib/resend";

export async function sendTestEmailAction(to: string) {
  try {
    if (!to) {
      return { success: false, message: 'Email is required' };
    }

    const result = await sendTestEmail(to);

    if (result.success) {
      return { success: true, message: 'Test email sent successfully' };
    } else {
      return { success: false, message: 'Failed to send test email', error: result.error };
    }
  } catch (error: any) {
    console.error('Test email error:', error);
    return { success: false, message: error.message || 'Internal server error' };
  }
}
