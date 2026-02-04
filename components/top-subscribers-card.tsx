'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import Link from 'next/link';

interface TopSubscriber {
  id: string;
  full_name: string;
  totalPaid: number;
}

interface TopSubscribersCardProps {
  subscribers: TopSubscriber[];
}

export function TopSubscribersCard({ subscribers }: TopSubscribersCardProps) {
  return (
    <Card className="bg-white border-gray-200 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -translate-y-1/2 translate-x-1/2" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-gray-500">Top Subscribers</p>
            {subscribers.length === 0 ? (
              <p className="text-sm text-gray-400">No data yet</p>
            ) : (
              <div className="space-y-1">
                {subscribers.slice(0, 3).map((sub, i) => (
                  <Link 
                    key={sub.id} 
                    href={`/subscribers/${sub.id}`}
                    className="flex items-center gap-2 text-sm hover:bg-gray-50 rounded px-1 -mx-1"
                  >
                    <span className="w-4 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <span className="font-medium text-gray-900 truncate flex-1">{sub.full_name}</span>
                    <span className="text-gray-500 text-xs">Rs.{sub.totalPaid.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
