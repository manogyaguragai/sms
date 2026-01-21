'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
import { MoreHorizontal, Eye, Trash2, Search, Loader2 } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import type { Subscriber } from '@/lib/types';

interface SubscriberTableProps {
  initialSubscribers: Subscriber[];
}

export function SubscriberTable({ initialSubscribers }: SubscriberTableProps) {
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const filteredSubscribers = subscribers.filter(
    (sub) =>
      sub.full_name.toLowerCase().includes(search.toLowerCase()) ||
      sub.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from('subscribers')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setSubscribers((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success('Subscriber deleted successfully');
    } catch (error) {
      console.error('Error deleting subscriber:', error);
      toast.error('Failed to delete subscriber');
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
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-500 border-gray-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const days = differenceInDays(startOfDay(new Date(endDate)), startOfDay(new Date()));
    if (days < 0) return <span className="text-red-600">Expired</span>;
    if (days === 0) return <span className="text-amber-500">Today</span>;
    if (days <= 7) return <span className="text-amber-500">{days} days</span>;
    return <span className="text-gray-500">{days} days</span>;
  };

  return (
    <>
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-gray-200">
              <TableHead className="text-gray-500">Name</TableHead>
              <TableHead className="text-gray-500">Email</TableHead>
              <TableHead className="text-gray-500">Status</TableHead>
              <TableHead className="text-gray-500">Frequency</TableHead>
              <TableHead className="text-gray-500">Rate</TableHead>
              <TableHead className="text-gray-500">Reminder Days</TableHead>
              <TableHead className="text-gray-500">Expires</TableHead>
              <TableHead className="text-gray-500">Remaining</TableHead>
              <TableHead className="text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {search ? 'No subscribers found matching your search' : 'No subscribers yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredSubscribers.map((subscriber) => (
                <TableRow
                  key={subscriber.id}
                  className="border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/subscribers/${subscriber.id}`)}
                >
                  <TableCell className="font-medium text-gray-900">
                    {subscriber.full_name}
                  </TableCell>
                  <TableCell className="text-gray-500">{subscriber.email}</TableCell>
                  <TableCell>{getStatusBadge(subscriber.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-gray-300 text-gray-600 capitalize">
                      {subscriber.frequency}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-900">
                    Rs. {Number(subscriber.monthly_rate).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {subscriber.reminder_days_before} days
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {format(new Date(subscriber.subscription_end_date), 'MMM d, yyyy')}
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
