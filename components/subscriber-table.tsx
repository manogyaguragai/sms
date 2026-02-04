'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { deleteSubscriber } from '@/app/actions/subscriber';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, Eye, Trash2, Search, Loader2, AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { formatNepaliDate } from '@/lib/nepali-date';
import type { Subscriber } from '@/lib/types';
import type { SortColumn, SortOrder } from '@/app/actions/subscribers';

interface SubscriberTableProps {
  subscribers: Subscriber[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentSearch: string;
  currentStatus: string;
  currentFrequency: string;
  currentNoPayments: boolean;
  currentSortBy: SortColumn;
  currentSortOrder: SortOrder;
}

export function SubscriberTable({
  subscribers,
  totalCount,
  page,
  pageSize,
  totalPages,
  currentSearch,
  currentStatus,
  currentFrequency,
  currentNoPayments,
  currentSortBy,
  currentSortOrder,
}: SubscriberTableProps) {
  const [search, setSearch] = useState(currentSearch);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = useRole();
  const canDelete = hasPermission('DELETE_SUBSCRIBER');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== currentSearch) {
        updateParams({ search, page: '1' });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const result = await deleteSubscriber(deleteId);

      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success(result.message);
      router.refresh();
    } catch (error: any) {
      console.error('Error deleting subscriber:', error);
      toast.error(error.message || 'Failed to delete subscriber');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-50 text-green-600 border-green-200">Active</Badge>;
      case 'expired':
        return <Badge className="bg-red-50 text-red-600 border-red-200">Expired</Badge>;
      case 'inactive':
        return <Badge className="bg-amber-50 text-amber-600 border-amber-200">Inactive</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-500 border-gray-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSort = (column: SortColumn) => {
    let newOrder: SortOrder = 'asc';
    if (currentSortBy === column && currentSortOrder === 'asc') {
      newOrder = 'desc';
    }
    updateParams({ sortBy: column, sortOrder: newOrder, page: '1' });
  };

  const getDaysRemaining = (endDate: string) => {
    const days = differenceInDays(startOfDay(new Date(endDate)), startOfDay(new Date()));
    if (days < 0) return <span className="text-red-600">Expired</span>;
    if (days === 0) return <span className="text-amber-500">Today</span>;
    if (days <= 7) return <span className="text-amber-500">{days} days</span>;
    return <span className="text-gray-500">{days} days</span>;
  };

  // Calculate display range
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
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
    <>
      {/* Mobile-Optimized Filters and Search */}
      <div className="space-y-3 mb-6">
        {/* Search - Full width */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-600"
          />
        </div>

        {/* Filters - Grid layout for mobile */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-gray-500 hidden sm:block" />

          {/* Status Filter */}
          <Select
            value={currentStatus || 'all'}
            onValueChange={(value) => updateParams({ status: value === 'all' ? '' : value, page: '1' })}
          >
            <SelectTrigger className="w-full sm:w-[130px] h-10 bg-white border-gray-200 text-gray-900 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Frequency Filter */}
          <Select
            value={currentFrequency || 'all'}
            onValueChange={(value) => updateParams({ frequency: value === 'all' ? '' : value, page: '1' })}
          >
            <SelectTrigger className="w-full sm:w-[130px] h-10 bg-white border-gray-200 text-gray-900 text-sm">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="all">All Frequency</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>

          {/* No Payments Toggle */}
          <Button
            variant={currentNoPayments ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateParams({ noPayments: currentNoPayments ? '' : 'true', page: '1' })}
            className={currentNoPayments
              ? 'bg-blue-600 text-white hover:bg-blue-700 h-10'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100 h-10'
            }
          >
            No Payments Yet
          </Button>

          {/* Results Per Page - Hidden on mobile */}
          <Select
            value={String(pageSize)}
            onValueChange={(value) => updateParams({ pageSize: value, page: '1' })}
          >
            <SelectTrigger className="hidden sm:flex w-[100px] h-10 bg-white border-gray-200 text-gray-900 text-sm">
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {subscribers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
            {currentSearch || currentStatus || currentFrequency
              ? 'No subscribers found matching your filters'
              : 'No subscribers yet'}
          </div>
        ) : (
          subscribers.map((subscriber) => {
            const days = differenceInDays(startOfDay(new Date(subscriber.subscription_end_date)), startOfDay(new Date()));
            return (
              <div
                key={subscriber.id}
                onClick={() => router.push(`/subscribers/${subscriber.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{subscriber.full_name}</h3>
                      {subscriber.status === 'inactive' && subscriber.status_notes && (
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{subscriber.email || subscriber.phone || 'No contact'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(subscriber.status)}
                    <span className={`text-xs font-medium ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-500' : 'text-gray-500'
                      }`}>
                      {days < 0 ? 'Expired' : days === 0 ? 'Today' : `${days}d left`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-gray-200 text-gray-500 text-xs capitalize">
                      {subscriber.frequency}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-900">
                      <DropdownMenuItem className="text-gray-700 focus:text-gray-900 focus:bg-gray-100" asChild>
                        <Link href={`/subscribers/${subscriber.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-700 focus:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(subscriber.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table - Hidden on mobile */}
      <div className="hidden md:block rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-gray-200">
              <TableHead
                className="text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('full_name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  {currentSortBy === 'full_name' ? (
                    currentSortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-gray-500">Email</TableHead>
              <TableHead className="text-gray-500">Status</TableHead>
              <TableHead className="text-gray-500">Frequency</TableHead>
              <TableHead className="text-gray-500">Reminder Days</TableHead>
              <TableHead
                className="text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('subscription_end_date')}
              >
                <div className="flex items-center gap-1">
                  Expires
                  {currentSortBy === 'subscription_end_date' ? (
                    currentSortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-gray-500">Remaining</TableHead>
              <TableHead className="text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {currentSearch || currentStatus || currentFrequency
                    ? 'No subscribers found matching your filters'
                    : 'No subscribers yet'}
                </TableCell>
              </TableRow>
            ) : (
                subscribers.map((subscriber) => (
                <TableRow
                  key={subscriber.id}
                  className="border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/subscribers/${subscriber.id}`)}
                >
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {subscriber.full_name}
                      {subscriber.status === 'inactive' && subscriber.status_notes && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="w-4 h-4 text-amber-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-gray-900 text-white">
                              <p className="text-sm">{subscriber.status_notes}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500">{subscriber.email || 'N/A'}</TableCell>
                  <TableCell>{getStatusBadge(subscriber.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-gray-300 text-gray-600 capitalize">
                      {subscriber.frequency}
                    </Badge>
                    </TableCell>
                  <TableCell className="text-gray-500">
                    {subscriber.reminder_days_before} days
                  </TableCell>
                  <TableCell className="text-gray-500">
                      {formatNepaliDate(subscriber.subscription_end_date, 'short')}
                  </TableCell>
                  <TableCell>{getDaysRemaining(subscriber.subscription_end_date)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-900">
                        <DropdownMenuItem
                          className="text-gray-700 focus:text-gray-900 focus:bg-gray-100"
                          asChild
                        >
                          <Link href={`/subscribers/${subscriber.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700 focus:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(subscriber.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
          {/* Results Info */}
          <p className="text-sm text-gray-500">
            Showing {startItem} to {endItem} of {totalCount} results
          </p>

          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: '1' })}
              disabled={page === 1}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* Previous Page */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: String(page - 1) })}
              disabled={page === 1}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page Numbers */}
            {getPageNumbers().map((pageNum, index) => (
              <Button
                key={index}
                variant={pageNum === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => typeof pageNum === 'number' && updateParams({ page: String(pageNum) })}
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

            {/* Next Page */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: String(page + 1) })}
              disabled={page === totalPages}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Last Page */}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Delete Subscriber</DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to delete this subscriber? This action cannot be undone
              and will also delete all associated payment records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteId(null)}
              className="text-gray-500 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
