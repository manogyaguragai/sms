import { getSubscribersPaginated } from '@/app/actions/subscribers';
import { SubscriberTable } from '@/components/subscriber-table';
import { Button } from '@/components/ui/button';
import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    frequency?: string;
  }>;
}

export default async function SubscribersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '10', 10);
  const search = params.search || '';
  const status = params.status || '';
  const frequency = params.frequency || '';

  const result = await getSubscribersPaginated({
    page,
    pageSize,
    search,
    status,
    frequency,
  });

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
            Manage your {result.totalCount} subscriber{result.totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
          <Link href="/subscribers/new">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Subscriber
          </Link>
        </Button>
      </div>

      {/* Table with Pagination */}
      <SubscriberTable
        subscribers={result.subscribers}
        totalCount={result.totalCount}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        currentSearch={search}
        currentStatus={status}
        currentFrequency={frequency}
      />
    </div>
  );
}
