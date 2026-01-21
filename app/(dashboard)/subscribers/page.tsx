import { createClient } from '@/lib/supabase/server';
import { SubscriberTable } from '@/components/subscriber-table';
import { Button } from '@/components/ui/button';
import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import type { Subscriber } from '@/lib/types';

async function getSubscribers() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscribers:', error);
    return [];
  }

  return data as Subscriber[];
}

export default async function SubscribersPage() {
  const subscribers = await getSubscribers();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Subscribers
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
          <Link href="/subscribers/new">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Subscriber
          </Link>
        </Button>
      </div>

      {/* Table */}
      <SubscriberTable initialSubscribers={subscribers} />
    </div>
  );
}
