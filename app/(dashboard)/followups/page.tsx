import { getFollowupsPaginated } from '@/app/actions/followups';
import { FollowupsClient } from '@/components/followups-client';
import { hasPermission } from '@/lib/rbac';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
  }>;
}

export default async function FollowupsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '10', 10);
  const search = params.search || '';

  const [result, canCreate, canEdit, canDelete] = await Promise.all([
    getFollowupsPaginated({
      page,
      pageSize,
      search,
    }),
    hasPermission('CREATE_FOLLOWUP'),
    hasPermission('UPDATE_FOLLOWUP'),
    hasPermission('DELETE_FOLLOWUP'),
  ]);

  return (
    <FollowupsClient
      followups={result.followups}
      totalCount={result.totalCount}
      page={result.page}
      pageSize={result.pageSize}
      totalPages={result.totalPages}
      currentSearch={search}
      canCreateFollowup={canCreate}
      canEditFollowup={canEdit}
      canDeleteFollowup={canDelete}
    />
  );
}
