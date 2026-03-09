'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TrendingUp, Calendar, DollarSign, User } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CollectionPaymentRecord {
  subscriberName: string;
  amount: number;
  paymentDate: string; // ISO or display string
}

export interface CollectionRateMonthData {
  month: string;
  expected: number;
  collected: number;
  rate: number; // percentage
  subscriberCount: number;
  payments: CollectionPaymentRecord[];
}

interface CollectionRateChartProps {
  data: Record<string, CollectionRateMonthData[]>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TAB_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  '12_hajar': '12 Hajar',
};

const TAB_ORDER = ['monthly', 'annual', '12_hajar'];

const RATE_LABELS: Record<string, string> = {
  monthly: 'Rs. 500/mo per subscriber · Last 6 months + current',
  annual: 'Rs. 6,000/yr per subscriber · Last 3 years + current',
  '12_hajar': 'Rs. 12,000/yr per subscriber · Last 3 years + current',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getBarColor(rate: number): string {
  if (rate >= 80) return '#10b981'; // emerald-500
  if (rate >= 50) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

function getBarHoverColor(rate: number): string {
  if (rate >= 80) return '#059669'; // emerald-600
  if (rate >= 50) return '#d97706'; // amber-600
  return '#dc2626'; // red-600
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as CollectionRateMonthData | undefined;
  if (!data) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">Expected</span>
          <span className="font-medium text-gray-900">Rs. {data.expected.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">Collected</span>
          <span className="font-medium text-green-600">Rs. {data.collected.toLocaleString()}</span>
        </div>
        <div className="border-t border-gray-100 pt-1.5 flex items-center justify-between">
          <span className="text-gray-500">Rate</span>
          <span
            className={cn(
              'font-bold',
              data.rate >= 80
                ? 'text-emerald-600'
                : data.rate >= 50
                  ? 'text-amber-600'
                  : 'text-red-600'
            )}
          >
            {data.rate}%
          </span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">Click for details</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Modal                                                       */
/* ------------------------------------------------------------------ */

interface DetailModalProps {
  data: CollectionRateMonthData;
  open: boolean;
  onClose: () => void;
  planLabel: string;
}

function DetailModal({ data, open, onClose, planLabel }: DetailModalProps) {
  // Group payments by paymentDate
  const groupedByDate = new Map<string, CollectionPaymentRecord[]>();
  for (const p of data.payments) {
    const dateKey = p.paymentDate;
    if (!groupedByDate.has(dateKey)) {
      groupedByDate.set(dateKey, []);
    }
    groupedByDate.get(dateKey)!.push(p);
  }

  // Sort dates (most recent first)
  const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => {
    const da = new Date(a);
    const db = new Date(b);
    return db.getTime() - da.getTime();
  });

  const gap = data.expected - data.collected;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            {data.month} — {planLabel}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Payment collection breakdown for this month
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mt-1">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Expected</p>
            <p className="text-sm font-bold text-blue-700 mt-0.5">Rs. {data.expected.toLocaleString()}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Collected</p>
            <p className="text-sm font-bold text-emerald-700 mt-0.5">Rs. {data.collected.toLocaleString()}</p>
          </div>
          <div className={cn('rounded-lg p-3 text-center', gap > 0 ? 'bg-red-50' : 'bg-emerald-50')}>
            <p className={cn('text-[10px] font-medium uppercase tracking-wide', gap > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {gap > 0 ? 'Gap' : 'Surplus'}
            </p>
            <p className={cn('text-sm font-bold mt-0.5', gap > 0 ? 'text-red-700' : 'text-emerald-700')}>
              Rs. {Math.abs(gap).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Collection Rate Bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Collection Rate</span>
            <span
              className={cn(
                'font-bold',
                data.rate >= 80 ? 'text-emerald-600' : data.rate >= 50 ? 'text-amber-600' : 'text-red-600'
              )}
            >
              {data.rate}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                data.rate >= 80 ? 'bg-emerald-500' : data.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${Math.min(data.rate, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {data.subscriberCount} active subscriber{data.subscriberCount !== 1 ? 's' : ''} of this plan
          </p>
        </div>

        {/* Payments grouped by date */}
        <div className="mt-3 flex-1 overflow-y-auto min-h-0 space-y-3">
          {data.payments.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No payments recorded for this month
            </div>
          ) : (
            sortedDates.map((dateKey) => {
              const datePayments = groupedByDate.get(dateKey)!;
              const dateTotal = datePayments.reduce((s, p) => s + p.amount, 0);

              return (
                <div key={dateKey} className="border border-gray-100 rounded-lg overflow-hidden">
                  {/* Date header */}
                  <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {dateKey}
                    </div>
                    <span className="text-xs font-semibold text-gray-900">
                      Rs. {dateTotal.toLocaleString()}
                    </span>
                  </div>
                  {/* Individual payments */}
                  <div className="divide-y divide-gray-50">
                    {datePayments.map((p, i) => (
                      <div
                        key={`${dateKey}-${i}`}
                        className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <User className="w-3 h-3 text-gray-400" />
                          {p.subscriberName}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-900">
                          <DollarSign className="w-3 h-3 text-gray-400" />
                          {p.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Chart Component                                               */
/* ------------------------------------------------------------------ */

export function CollectionRateChart({ data }: CollectionRateChartProps) {
  const availableTabs = TAB_ORDER.filter(
    (key) => data[key] && data[key].length > 0
  );

  const [activeTab, setActiveTab] = useState(availableTabs[0] || 'monthly');
  const [selectedMonth, setSelectedMonth] = useState<CollectionRateMonthData | null>(null);

  if (availableTabs.length === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Payment Collection Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
            Not enough data to display collection trends yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data[activeTab] || [];

  const enrichedData = chartData.map((d) => ({
    ...d,
    rateLabel: `${d.rate}%`,
  }));

  const handleBarClick = (data: CollectionRateMonthData) => {
    setSelectedMonth(data);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedMonth(null);
  };

  return (
    <>
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Payment Collection Rate
            </CardTitle>
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer',
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {TAB_LABELS[tab] || tab}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {RATE_LABELS[activeTab]} · Click a bar for details
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={enrichedData}
                barCategoryGap="20%"
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#6b7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (max: number) => Math.max(max, 110)]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                <ReferenceLine
                  y={100}
                  stroke="#6b7280"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: '100%',
                    position: 'right',
                    style: { fontSize: 10, fill: '#6b7280', fontWeight: 500 },
                  }}
                />
                <Bar
                  dataKey="rate"
                  radius={[4, 4, 0, 0]}
                  name="Collection Rate"
                  onClick={(data: any) => handleBarClick(data as CollectionRateMonthData)}
                >
                  {enrichedData.map((entry, index) => (
                    <Cell
                      key={`rate-${index}`}
                      cursor="pointer"
                      fill={
                        selectedMonth?.month === entry.month
                          ? getBarHoverColor(entry.rate)
                          : getBarColor(entry.rate)
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="rateLabel"
                    position="top"
                    style={{ fontSize: 10, fontWeight: 600, fill: '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>≥ 80%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500" />
              <span>50–79%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              <span>&lt; 50%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedMonth && (
        <DetailModal
          data={selectedMonth}
          open={!!selectedMonth}
          onClose={() => setSelectedMonth(null)}
          planLabel={TAB_LABELS[activeTab] || activeTab}
        />
      )}
    </>
  );
}
