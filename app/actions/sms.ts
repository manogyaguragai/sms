'use server';

import { sendTestSMS } from '@/lib/notification';

export async function sendTestSMSAction(phoneNumber: string) {
  try {
    const result = await sendTestSMS(phoneNumber);
    return result;
  } catch (error) {
    console.error('Error in sendTestSMSAction:', error);
    return { success: false, message: 'Failed to send test SMS' };
  }
}
