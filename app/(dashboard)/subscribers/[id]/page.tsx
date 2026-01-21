import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { SubscriberProfile } from '@/components/subscriber-profile';
import type { Subscriber, Payment } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSubscriber(id: string) {
  const supabase = await createClient();

  const { data: subscriber, error: subscriberError } = await supabase
    .from('subscribers')
    .select('*')
    .eq('id', id)
    .single();

  if (subscriberError || !subscriber) {
    return null;
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('subscriber_id', id)
    .order('payment_date', { ascending: false });

  return {
    subscriber: subscriber as Subscriber,
    payments: (payments || []) as Payment[],
  };
}

export default async function SubscriberDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getSubscriber(id);

  if (!data) {
    notFound();
  }

  return <SubscriberProfile subscriber={data.subscriber} payments={data.payments} />;
}
