'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NepaliDateRangePicker } from '@/components/ui/nepali-date-range-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, TrendingUp, Search, ChevronDown, Crown } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { NEPALI_MONTHS_SHORT } from '@/lib/nepali-date';

interface Subscriber {
  id: string;
  full_name: string;
}

interface Payment {
  id: string;
  subscriber_id: string;
  amount_paid: number;
  payment_date: string;
}

interface FinancialsAnalyticsProps {
  subscribers: Subscriber[];
  payments: Payment[];
}

interface DateRange {
  startDate: string;
  endDate: string;
}

export function FinancialsAnalytics({ subscribers, payments }: FinancialsAnalyticsProps) {
  // Initialize with current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: startOfMonth.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  });
  
  // Default to first subscriber
  const [selectedUserId, setSelectedUserId] = useState<string>(subscribers[0]?.id || '');
  const [userSearch, setUserSearch] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Filter payments by date range
  const filteredPayments = useMemo(() => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    end.setHours(23, 59, 59, 999); // Include full end day
    
    return payments.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return paymentDate >= start && paymentDate <= end;
    });
  }, [payments, dateRange]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalCollected = filteredPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
    const paymentCount = filteredPayments.length;
    const averagePayment = paymentCount > 0 ? totalCollected / paymentCount : 0;
    const uniqueUsers = new Set(filteredPayments.map(p => p.subscriber_id)).size;
    
    return {
      totalCollected,
      averagePayment,
      paymentCount,
      uniqueUsers,
    };
  }, [filteredPayments]);

  // Filter subscribers for dropdown search
  const filteredSubscribers = useMemo(() => {
    if (!userSearch) return subscribers;
    const search = userSearch.toLowerCase();
    return subscribers.filter(s => s.full_name.toLowerCase().includes(search));
  }, [subscribers, userSearch]);

  // Get user payments by month for chart
  const userPaymentData = useMemo(() => {
    if (!selectedUserId) return [];
    
    const userPayments = filteredPayments.filter(p => p.subscriber_id === selectedUserId);
    
    // Group by month
    const monthlyData = new Map<string, number>();
    
    userPayments.forEach(p => {
      const date = new Date(p.payment_date);
      try {
        const nepaliDate = new NepaliDate(date);
        const monthKey = `${NEPALI_MONTHS_SHORT[nepaliDate.getMonth()]} ${nepaliDate.getYear()}`;
        const existing = monthlyData.get(monthKey) || 0;
        monthlyData.set(monthKey, existing + Number(p.amount_paid));
      } catch {
        // Fallback to English date if Nepali conversion fails
        const monthKey = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        const existing = monthlyData.get(monthKey) || 0;
        monthlyData.set(monthKey, existing + Number(p.amount_paid));
      }
    });
    
    return Array.from(monthlyData.entries()).map(([month, amount]) => ({
      month,
      amount,
    }));
  }, [selectedUserId, filteredPayments]);

  // Calculate top subscribers by total payments in date range
  const topSubscribers = useMemo(() => {
    const subscriberTotals = new Map<string, number>();
    
    filteredPayments.forEach(p => {
      const existing = subscriberTotals.get(p.subscriber_id) || 0;
      subscriberTotals.set(p.subscriber_id, existing + Number(p.amount_paid));
    });
    
    return Array.from(subscriberTotals.entries())
      .map(([id, total]) => ({
        id,
        name: subscribers.find(s => s.id === id)?.full_name || 'Unknown',
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filteredPayments, subscribers]);

  const selectedUser = subscribers.find(s => s.id === selectedUserId);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top Row - Date Range and User Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <NepaliDateRangePicker 
          value={dateRange} 
          onChange={setDateRange}
          className="w-full sm:w-[60%]"
        />
        
        {/* User Selection Dropdown */}
        <div className="w-full sm:w-[40%]">
          <Popover open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">
                    {selectedUser?.full_name || 'Select a user...'}
                  </span>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0 bg-white" align="start">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  {filteredSubscribers.length > 0 ? (
                    filteredSubscribers.slice(0, 50).map((subscriber) => (
                      <button
                        key={subscriber.id}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 ${
                          subscriber.id === selectedUserId ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                        onClick={() => {
                          setSelectedUserId(subscriber.id);
                          setUserDropdownOpen(false);
                          setUserSearch('');
                        }}
                      >
                        {subscriber.full_name}
                      </button>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      No users found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Line Chart */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-gray-900 text-base">
            Payment History: {selectedUser?.full_name || 'No user selected'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedUserId ? (
            userPaymentData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userPaymentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6b7280" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `Rs.${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        borderRadius: '8px', 
                        border: '1px solid #e5e7eb' 
                      }}
                      formatter={(value) => [`Rs. ${(value as number).toLocaleString()}`, 'Amount']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#2563eb' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                <p>No payments found for {selectedUser?.full_name} in this period</p>
              </div>
            )
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              <p>No users available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Row - Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Total Collected</p>
                <p className="text-2xl font-bold text-gray-900">Rs. {analytics.totalCollected.toLocaleString()}</p>
                <p className="text-xs text-blue-600 font-medium">
                  {analytics.uniqueUsers} users, {analytics.paymentCount} payments
                </p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Average per User</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rs. {analytics.uniqueUsers > 0 
                    ? (analytics.totalCollected / analytics.uniqueUsers).toFixed(0) 
                    : '0'}
                </p>
                <p className="text-xs text-gray-500">
                  In selected period
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Subscribers Card */}
      <Card className="bg-white border-gray-200 shadow-sm flex-1">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">Top Subscribers</p>
          </div>
          {topSubscribers.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {topSubscribers.map((sub, index) => (
                <div key={sub.id} className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-200 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-800 truncate max-w-[100px]">{sub.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">Rs. {sub.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No payments in this period</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
