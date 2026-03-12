'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFollowupsBySubscriber } from '@/app/actions/followups';
import type { FollowupWithDetails } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PhoneCall,
  Calendar,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
} from 'lucide-react';

interface SubscriberFollowupsModalProps {
  subscriberId: string;
  subscriberName: string;
  open: boolean;
  onClose: () => void;
  canCreateFollowup: boolean;
}

export function SubscriberFollowupsModal({
  subscriberId,
  subscriberName,
  open,
  onClose,
  canCreateFollowup,
}: SubscriberFollowupsModalProps) {
  const [followups, setFollowups] = useState<FollowupWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 5;
  const router = useRouter();

  useEffect(() => {
    if (open && subscriberId) {
      fetchFollowups(1);
    }
  }, [open, subscriberId]);

  const fetchFollowups = async (p: number) => {
    setLoading(true);
    try {
      const result = await getFollowupsBySubscriber(subscriberId, p, pageSize);
      setFollowups(result.followups);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
      setPage(p);
    } catch (error) {
      console.error('Error fetching followups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFollowups([]);
    setPage(1);
    setTotalPages(0);
    setTotalCount(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="bg-white border-slate-200 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <PhoneCall className="w-4 h-4 text-blue-600" />
            </div>
            Followup History — {subscriberName}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-3 w-48 mb-1" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : followups.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <PhoneCall className="w-7 h-7 text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-300">No followup records</p>
              <p className="text-xs text-slate-400 mt-1">
                No followup calls have been recorded for this subscriber.
              </p>
              {canCreateFollowup && (
                <Button
                  onClick={() => {
                    handleClose();
                    router.push('/followups');
                  }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3 shrink-0 mt-3"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Followup
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400">
                  {totalCount} followup{totalCount !== 1 ? 's' : ''} recorded
                </p>
                {canCreateFollowup && (
                  <Button
                    onClick={() => {
                      handleClose();
                      router.push('/followups');
                    }}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Followup
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {followups.map((followup) => (
                  <div
                    key={followup.id}
                    className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors"
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-sm font-semibold text-slate-800">
                          {followup.followup_date}
                        </span>
                      </div>
                      {followup.followup_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {followup.followup_time}
                          </span>
                        </div>
                      )}
                      {followup.phone_number && (
                        <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-400">
                          {followup.phone_number}
                        </Badge>
                      )}
                    </div>

                    {/* Made by */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-400">By:</span>
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

                    {/* Notes */}
                    {followup.notes && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="flex items-start gap-1.5">
                          <FileText className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
                          <div
                            className="text-sm text-slate-600 leading-relaxed followup-notes-content"
                            dangerouslySetInnerHTML={{ __html: followup.notes }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchFollowups(page - 1)}
                      disabled={page === 1 || loading}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-slate-400 px-2 tabular-nums font-medium">
                      {page}/{totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchFollowups(page + 1)}
                      disabled={page === totalPages || loading}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <style jsx global>{`
          .followup-notes-content h1 { font-size: 1.25rem; font-weight: 700; margin: 0.3rem 0; }
          .followup-notes-content h2 { font-size: 1.1rem; font-weight: 600; margin: 0.25rem 0; }
          .followup-notes-content h3 { font-size: 1rem; font-weight: 600; margin: 0.2rem 0; }
          .followup-notes-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.3rem 0; }
          .followup-notes-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.3rem 0; }
          .followup-notes-content li { margin: 0.1rem 0; }
          .followup-notes-content mark { background-color: #fef08a; border-radius: 2px; padding: 0 2px; }
          .followup-notes-content p { margin: 0.15rem 0; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
