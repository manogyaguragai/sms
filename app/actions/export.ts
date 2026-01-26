'use server';

import { createClient } from '@/lib/supabase/server';
import { jsonToCsv } from '@/lib/csv';
import { formatNepaliDateTime } from '@/lib/nepali-date';

type ExportType = 'subscribers' | 'payments' | 'both';

export async function exportData(
  type: ExportType,
  startDate?: string,
  endDate?: string
) {
  const supabase = await createClient();

  try {
    let subscribersCsv: string | undefined;
    let paymentsCsv: string | undefined;

    // Helper to format date in Nepali B.S. format for consistency
    const formatDate = (date: string | null) => 
      date ? formatNepaliDateTime(date) : '';
    
    // Adjust end date to include the full day
    const adjustedEndDate = endDate ? `${endDate}T23:59:59.999Z` : undefined;
    const adjustedStartDate = startDate ? `${startDate}T00:00:00.000Z` : undefined;


    if (type === 'subscribers' || type === 'both') {
      let query = supabase.from('subscribers').select('*');

      if (startDate) {
        query = query.gte('created_at', adjustedStartDate!);
      }
      if (endDate) {
        query = query.lte('created_at', adjustedEndDate!);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedData = data.map(sub => ({
            ID: sub.id,
            'Full Name': sub.full_name,
            Email: sub.email,
            Phone: sub.phone,
            Status: sub.status,
            Frequency: sub.frequency,
            'Monthly Rate': sub.monthly_rate,
            'Reminder Days': sub.reminder_days_before,
            'Subscription End Date': formatDate(sub.subscription_end_date),
            'Created At': formatDate(sub.created_at),
            'Referred By': sub.referred_by || '',
            'Status Notes': sub.status_notes || ''
        }));
        subscribersCsv = jsonToCsv(formattedData);
      } else {
          // Return headers even if empty
           subscribersCsv = jsonToCsv([{
            ID: '', 'Full Name': '', Email: '', Phone: '', Status: '', Frequency: '', 
            'Monthly Rate': '', 'Reminder Days': '', 'Subscription End Date': '', 
            'Created At': '', 'Referred By': '', 'Status Notes': ''
           }]);
      }
    }

    if (type === 'payments' || type === 'both') {
      let query = supabase
        .from('payments')
        .select(`
          *,
          subscribers (
            full_name,
            email
          )
        `);

      if (startDate) {
        query = query.gte('payment_date', adjustedStartDate!);
      }
      if (endDate) {
        query = query.lte('payment_date', adjustedEndDate!);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedData = data.map((payment: any) => ({
          ID: payment.id,
          'Subscriber Name': payment.subscribers?.full_name || 'Unknown',
          'Subscriber Email': payment.subscribers?.email || '',
          'Amount Paid': payment.amount_paid,
          'Payment Date': formatDate(payment.payment_date),
          'Payment For Period': payment.payment_for_period || '',
          'Payment Mode': payment.payment_mode || '',
          'Receipt Number': payment.receipt_number || '',
           Notes: payment.notes || ''
        }));
        paymentsCsv = jsonToCsv(formattedData);
      } else {
           paymentsCsv = jsonToCsv([{
               ID: '', 'Subscriber Name': '', 'Subscriber Email': '', 'Amount Paid': '', 
               'Payment Date': '', 'Payment For Period': '', 'Payment Mode': '', 
               'Receipt Number': '', Notes: ''
           }]);
      }
    }

    return { success: true, subscribers: subscribersCsv, payments: paymentsCsv };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: 'Failed to export data' };
  }
}
