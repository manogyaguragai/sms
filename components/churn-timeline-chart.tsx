'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TrendingDown, UserCheck, UserX, UserPlus, ArrowDownRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChurnDataPoint {
  label: string;
  index: number;
  activeCount: number;
  churnedCount: number;
  newlyChurnedCount: number;
  returnedCount: number;
  totalCount: number;
  activeSubscribers: { id: string; name: string }[];
  churnedSubscribers: { id: string; name: string }[];
  newlyChurnedSubscribers: { id: string; name: string }[];
  returnedSubscribers: { id: string; name: string }[];
}

export interface FrequencyChurnData {
  isYearly: boolean;
  series: Record<string, ChurnDataPoint[]>;
}

// freq -> FrequencyChurnData
export type ChurnTimelineData = Record<string, FrequencyChurnData>;

interface ChurnTimelineChartProps {
  data: ChurnTimelineData;
  currentYear: number;
  currentMonth: number; // 0-indexed
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

const LINE_COLORS: Record<string, string> = {
  monthly: '#3b82f6',
  annual: '#8b5cf6',
  '12_hajar': '#f59e0b',
};

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as ChurnDataPoint | undefined;
  if (!data) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3.5 text-sm min-w-[210px]">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-gray-500">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            Active
          </span>
          <span className="font-bold text-emerald-600">{data.activeCount}</span>
        </div>
        {data.newlyChurnedCount > 0 && (
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-gray-500">
              <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              Newly Churned
            </span>
            <span className="font-bold text-red-500">{data.newlyChurnedCount}</span>
          </div>
        )}
        {data.returnedCount > 0 && (
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-gray-500">
              <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              Returned
            </span>
            <span className="font-bold text-blue-500">{data.returnedCount}</span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-1.5 flex items-center justify-between">
          <span className="text-gray-500">Total</span>
          <span className="font-semibold text-gray-900">{data.totalCount}</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">Click dot for details</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Dot (clickable, with current-period highlight)              */
/* ------------------------------------------------------------------ */

function ClickableDot({
  cx,
  cy,
  payload,
  onClick,
  color,
  isCurrentPeriod,
}: {
  cx?: number;
  cy?: number;
  payload?: ChurnDataPoint;
  onClick: (data: ChurnDataPoint) => void;
  color: string;
  isCurrentPeriod?: boolean;
}) {
  if (cx === undefined || cy === undefined || !payload) return null;

  return (
    <g>
      {/* Invisible hit area */}
      <circle cx={cx} cy={cy} r={14} fill="transparent" className="cursor-pointer" onClick={() => onClick(payload)} />
      {/* Current period pulsing ring */}
      {isCurrentPeriod && (
        <circle cx={cx} cy={cy} r={12} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 2" opacity={0.5}>
          <animate attributeName="r" values="12;15;12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Outer glow */}
      <circle cx={cx} cy={cy} r={isCurrentPeriod ? 9 : 8} fill={color} fillOpacity={isCurrentPeriod ? 0.25 : 0.15} className="cursor-pointer" onClick={() => onClick(payload)} />
      {/* Main dot */}
      <circle cx={cx} cy={cy} r={isCurrentPeriod ? 6 : 5} fill={isCurrentPeriod ? color : 'white'} stroke={color} strokeWidth={2.5} className="cursor-pointer" onClick={() => onClick(payload)} />
      {/* Inner dot for current */}
      {isCurrentPeriod && (
        <circle cx={cx} cy={cy} r={2} fill="white" className="cursor-pointer" onClick={() => onClick(payload)} />
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Modal                                                       */
/* ------------------------------------------------------------------ */

interface DetailModalProps {
  data: ChurnDataPoint;
  open: boolean;
  onClose: () => void;
  periodLabel: string;
  freqLabel: string;
}

function DetailModal({ data, open, onClose, periodLabel, freqLabel }: DetailModalProps) {
  type TabKey = 'active' | 'newlyChurned' | 'returned' | 'allChurned';
  const [showTab, setShowTab] = useState<TabKey>('newlyChurned');

  const activeRate = data.totalCount > 0
    ? Math.round((data.activeCount / data.totalCount) * 100)
    : 0;

  const tabs: { key: TabKey; label: string; count: number; color: string; activeColor: string }[] = [
    { key: 'newlyChurned', label: 'Newly Churned', count: data.newlyChurnedCount, color: 'text-gray-500 hover:text-gray-700', activeColor: 'bg-white text-red-700 shadow-sm' },
    { key: 'returned', label: 'Returned', count: data.returnedCount, color: 'text-gray-500 hover:text-gray-700', activeColor: 'bg-white text-blue-700 shadow-sm' },
    { key: 'active', label: 'Active', count: data.activeCount, color: 'text-gray-500 hover:text-gray-700', activeColor: 'bg-white text-emerald-700 shadow-sm' },
    { key: 'allChurned', label: 'All Churned', count: data.churnedCount, color: 'text-gray-500 hover:text-gray-700', activeColor: 'bg-white text-slate-700 shadow-sm' },
  ];

  const listMap: Record<TabKey, { list: { id: string; name: string }[]; icon: React.ReactNode; emptyMsg: string; hoverBg: string }> = {
    active: {
      list: data.activeSubscribers,
      icon: <UserCheck className="w-3.5 h-3.5 text-emerald-600" />,
      emptyMsg: 'No active subscribers',
      hoverBg: 'hover:bg-emerald-50/50',
    },
    newlyChurned: {
      list: data.newlyChurnedSubscribers,
      icon: <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />,
      emptyMsg: 'No newly churned subscribers 🎉',
      hoverBg: 'hover:bg-red-50/50',
    },
    returned: {
      list: data.returnedSubscribers,
      icon: <UserPlus className="w-3.5 h-3.5 text-blue-500" />,
      emptyMsg: 'No returned subscribers',
      hoverBg: 'hover:bg-blue-50/50',
    },
    allChurned: {
      list: data.churnedSubscribers,
      icon: <UserX className="w-3.5 h-3.5 text-slate-500" />,
      emptyMsg: 'No churned subscribers 🎉',
      hoverBg: 'hover:bg-slate-50/50',
    },
  };

  const current = listMap[showTab];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            {periodLabel} — {freqLabel}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Subscriber activity breakdown
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mt-1">
          <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Active</p>
            <p className="text-sm font-bold text-emerald-700 mt-0.5">{data.activeCount}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide">New Churn</p>
            <p className="text-sm font-bold text-red-700 mt-0.5">{data.newlyChurnedCount}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Returned</p>
            <p className="text-sm font-bold text-blue-700 mt-0.5">{data.returnedCount}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Rate</p>
            <p className={cn(
              'text-sm font-bold mt-0.5',
              activeRate >= 80 ? 'text-emerald-700' : activeRate >= 50 ? 'text-amber-700' : 'text-red-700'
            )}>{activeRate}%</p>
          </div>
        </div>

        {/* Retention bar */}
        <div className="mt-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                activeRate >= 80 ? 'bg-emerald-500' : activeRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${Math.min(activeRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1 mt-3">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setShowTab(t.key)}
              className={cn(
                'px-2 py-1.5 text-[11px] font-medium rounded-md transition-all cursor-pointer text-center',
                showTab === t.key ? t.activeColor : t.color
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* List */}
        <div className="mt-3 flex-1 overflow-y-auto min-h-0">
          {current.list.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {current.emptyMsg}
            </div>
          ) : (
            <div className="space-y-1">
              {current.list.map((sub) => (
                <div
                  key={sub.id}
                  className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors', current.hoverBg)}
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    {current.icon}
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{sub.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Chart Component                                               */
/* ------------------------------------------------------------------ */

export function ChurnTimelineChart({ data, currentYear, currentMonth }: ChurnTimelineChartProps) {
  const availableTabs = TAB_ORDER.filter(
    (key) => data[key] && Object.keys(data[key].series).length > 0
  );

  const [activeTab, setActiveTab] = useState(availableTabs[0] || 'monthly');

  const freqData = data[activeTab];
  const isYearly = freqData?.isYearly ?? false;

  // Available years for year selector (monthly only)
  const availableYears = useMemo(() => {
    if (!freqData || isYearly) return [];
    return Object.keys(freqData.series).sort((a, b) => Number(b) - Number(a));
  }, [freqData, isYearly]);

  // Default to current Nepali year
  const [selectedYear, setSelectedYear] = useState(() => {
    const yearStr = String(currentYear);
    if (availableYears.includes(yearStr)) return yearStr;
    return availableYears[0] || '';
  });
  const [selectedPoint, setSelectedPoint] = useState<ChurnDataPoint | null>(null);

  const isCurrentYearSelected = selectedYear === String(currentYear);

  // When tab changes, reset
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedPoint(null);
    const tabData = data[tab];
    if (tabData && !tabData.isYearly) {
      const years = Object.keys(tabData.series).sort((a, b) => Number(b) - Number(a));
      const yearStr = String(currentYear);
      setSelectedYear(years.includes(yearStr) ? yearStr : years[0] || '');
    }
  };

  // Get chart data based on tab type
  const chartData = useMemo(() => {
    if (!freqData) return [];
    if (isYearly) {
      return freqData.series['all'] || [];
    }
    return freqData.series[selectedYear] || [];
  }, [freqData, isYearly, selectedYear]);

  const maxActive = useMemo(() => {
    return Math.max(...chartData.map(d => d.totalCount), 1);
  }, [chartData]);

  if (availableTabs.length === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            Churn Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
            Not enough data to display churn trends yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  const lineColor = LINE_COLORS[activeTab] || '#3b82f6';

  // Determine if a data point is the "current" period
  const isCurrentPeriod = (point: ChurnDataPoint) => {
    if (isYearly) {
      return point.index === currentYear;
    }
    return isCurrentYearSelected && point.index === currentMonth;
  };

  // Period label for modal
  const getPeriodLabel = (point: ChurnDataPoint) => {
    if (isYearly) return point.label;
    return `${point.label} ${selectedYear}`;
  };

  return (
    <>
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-blue-600" />
              Churn Timeline
            </CardTitle>

            <div className="flex items-center gap-3">
              {/* Year Selector — only for monthly */}
              {!isYearly && (
                <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setSelectedPoint(null); }}>
                  <SelectTrigger className="w-[120px] h-9 text-sm border-gray-200">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year} B.S.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Frequency Tabs */}
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
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isYearly
              ? 'Active subscriber count by year · Click a data point for details'
              : 'Active subscriber count by month · Click a data point for details'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#6b7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={isYearly ? 0 : -30}
                  textAnchor={isYearly ? 'middle' : 'end'}
                  height={50}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (max: number) => Math.max(max + 2, maxActive + 2)]}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={maxActive}
                  stroke="#d1d5db"
                  strokeDasharray="6 3"
                  strokeWidth={1}
                  label={{
                    value: `Total: ${maxActive}`,
                    position: 'right',
                    style: { fontSize: 10, fill: '#9ca3af', fontWeight: 500 },
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="activeCount"
                  stroke={lineColor}
                  strokeWidth={2.5}
                  name="Active"
                  dot={(props: any) => (
                    <ClickableDot
                      {...props}
                      onClick={(d) => setSelectedPoint(d)}
                      color={lineColor}
                      isCurrentPeriod={isCurrentPeriod(props.payload)}
                    />
                  )}
                  activeDot={{
                    r: 7,
                    fill: lineColor,
                    stroke: 'white',
                    strokeWidth: 2,
                    cursor: 'pointer',
                    onClick: (_: any, payload: any) => {
                      if (payload?.payload) setSelectedPoint(payload.payload as ChurnDataPoint);
                    },
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 rounded-full" style={{ backgroundColor: lineColor }} />
              <span>Active Subscribers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2" style={{ borderColor: lineColor, backgroundColor: 'white' }} />
              <span>Click for details</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lineColor }} />
              <span>Current {isYearly ? 'year' : 'month'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedPoint && (
        <DetailModal
          data={selectedPoint}
          open={!!selectedPoint}
          onClose={() => setSelectedPoint(null)}
          periodLabel={getPeriodLabel(selectedPoint)}
          freqLabel={TAB_LABELS[activeTab] || activeTab}
        />
      )}
    </>
  );
}
