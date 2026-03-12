'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FollowupModal } from '@/components/followup-modal';
import { FollowupDetailModal } from '@/components/followup-detail-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PhoneCall,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Clock,
  User,
  FileText,
  ExternalLink,
} from 'lucide-react';
import type { FollowupWithDetails } from '@/lib/types';

/** Strip HTML tags for plain-text preview */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

interface FollowupsClientProps {
  followups: FollowupWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentSearch: string;
  canCreateFollowup: boolean;
  canEditFollowup: boolean;
  canDeleteFollowup: boolean;
}

export function FollowupsClient({
  followups,
  totalCount,
  page,
  pageSize,
  totalPages,
  currentSearch,
  canCreateFollowup,
  canEditFollowup,
  canDeleteFollowup,
}: FollowupsClientProps) {
  const [search, setSearch] = useState(currentSearch);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState<FollowupWithDetails | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== currentSearch) {
        updateParams({ search, page: '1' });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router]
  );

  // Pagination
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-blue-600" />
            Followups
          </h1>
          <p className="text-gray-500 mt-1">
            {totalCount > 0
              ? `${totalCount} followup record${totalCount !== 1 ? 's' : ''}`
              : 'Track followup calls to subscribers'}
          </p>
        </div>
        {canCreateFollowup && totalCount > 0 && (
          <Button
            onClick={() => setShowFollowupModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Followup
          </Button>
        )}
      </div>

      {/* Search & Controls */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search by master ID, subscriber, phone, or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => updateParams({ pageSize: value, page: '1' })}
            >
              <SelectTrigger className="w-[100px] h-11 bg-white border-gray-200 text-gray-900 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {followups.length === 0 && !currentSearch ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 flex items-center justify-center mx-auto mb-5">
            <PhoneCall className="w-9 h-9 text-blue-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No followups recorded</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Start recording followup calls to keep track of subscriber interactions.
          </p>
          {canCreateFollowup && (
            <Button
              onClick={() => setShowFollowupModal(true)}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Record First Followup
            </Button>
          )}
        </div>
      ) : followups.length === 0 && currentSearch ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          No followups found matching &ldquo;{currentSearch}&rdquo;
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {followups.map((followup) => (
              <div
                key={followup.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm cursor-pointer hover:border-blue-200 hover:shadow-md transition-all"
                onClick={() => setSelectedFollowup(followup)}
              >
                {/* Subscriber Info + Date */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Link
                    href={`/subscribers/${followup.subscriber_id}`}
                    className="flex items-center gap-2 min-w-0 group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs font-mono font-extrabold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shadow-sm shrink-0">
                      {followup.subscribers.master_id}
                    </span>
                    <span className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {followup.subscribers.full_name}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 shrink-0" />
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">{followup.followup_date}</span>
                  </div>
                </div>

                {/* Made By */}
                <div className="flex items-center gap-1.5 mb-2">
                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {(followup.made_by_names || []).map((name, i) => (
                      <Badge
                        key={i}
                        className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Time & Phone */}
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                  {followup.followup_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {followup.followup_time}
                    </span>
                  )}
                  {followup.phone_number && (
                    <span className="flex items-center gap-1">
                      <PhoneCall className="w-3 h-3" />
                      {followup.phone_number}
                    </span>
                  )}
                </div>

                {/* Notes Preview */}
                {followup.notes && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-slate-500 line-clamp-3">
                      {stripHtml(followup.notes)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50 border-gray-200">
                  <TableHead className="text-gray-500">Subscriber</TableHead>
                  <TableHead className="text-gray-500">Phone</TableHead>
                  <TableHead className="text-gray-500">Made By</TableHead>
                  <TableHead className="text-gray-500">Date</TableHead>
                  <TableHead className="text-gray-500">Time</TableHead>
                  <TableHead className="text-gray-500">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {followups.map((followup) => (
                  <TableRow
                    key={followup.id}
                    className="border-gray-200 hover:bg-blue-50/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedFollowup(followup)}
                  >
                    <TableCell>
                      <Link
                        href={`/subscribers/${followup.subscriber_id}`}
                        className="flex items-center gap-2 group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs font-mono font-extrabold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shadow-sm shrink-0">
                          {followup.subscribers.master_id}
                        </span>
                        <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {followup.subscribers.full_name}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {followup.phone_number || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(followup.made_by_names || []).map((name, i) => (
                          <Badge
                            key={i}
                            className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0"
                          >
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm font-medium">
                      {followup.followup_date}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {followup.followup_time || '—'}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      {followup.notes ? (
                        <p className="text-sm text-gray-500 truncate">{stripHtml(followup.notes)}</p>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
              <p className="text-sm text-gray-500">
                Showing {startItem} to {endItem} of {totalCount} results
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParams({ page: '1' })}
                  disabled={page === 1}
                  className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParams({ page: String(page - 1) })}
                  disabled={page === 1}
                  className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((pageNum, index) => (
                  <Button
                    key={index}
                    variant={pageNum === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      typeof pageNum === 'number' && updateParams({ page: String(pageNum) })
                    }
                    disabled={typeof pageNum !== 'number'}
                    className={
                      pageNum === page
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }
                  >
                    {pageNum}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParams({ page: String(page + 1) })}
                  disabled={page === totalPages}
                  className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParams({ page: String(totalPages) })}
                  disabled={page === totalPages}
                  className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Followup Modal */}
      <FollowupModal
        open={showFollowupModal}
        onClose={() => setShowFollowupModal(false)}
      />

      {/* Detail Modal */}
      <FollowupDetailModal
        followup={selectedFollowup}
        open={!!selectedFollowup}
        onClose={() => setSelectedFollowup(null)}
        canEdit={canEditFollowup}
        canDelete={canDeleteFollowup}
        onUpdated={() => {
          setSelectedFollowup(null);
          router.refresh();
        }}
      />
    </div>
  );
}
