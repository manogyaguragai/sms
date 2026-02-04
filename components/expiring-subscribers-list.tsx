'use client';

import { useState } from 'react';
import Link from 'next/link';
import { differenceInDays, startOfDay } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Subscriber } from '@/lib/types';

interface Props {
  subscribers: Subscriber[];
}

const ITEMS_PER_PAGE = 5;

export function ExpiringSubscribersList({ subscribers }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(subscribers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSubscribers = subscribers.slice(startIndex, endIndex);

  if (subscribers.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4 text-center">
        No subscriptions expiring soon
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {currentSubscribers.map((sub) => {
        const daysLeft = differenceInDays(
          startOfDay(new Date(sub.subscription_end_date)),
          startOfDay(new Date())
        );
        return (
          <Link
            key={sub.id}
            href={`/subscribers/${sub.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9 bg-amber-500">
                <AvatarFallback className="bg-transparent text-white text-sm">
                  {sub.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {sub.full_name}
                </p>
                <p className="text-xs text-gray-500">{sub.email}</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`${
                daysLeft <= 3
                  ? 'border-red-200 text-red-600 bg-red-50'
                  : 'border-amber-200 text-amber-600 bg-amber-50'
              }`}
            >
              <Calendar className="w-3 h-3 mr-1" />
              {daysLeft} days
            </Badge>
          </Link>
        );
      })}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Showing {startIndex + 1}-{Math.min(endIndex, subscribers.length)} of {subscribers.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-600 px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
