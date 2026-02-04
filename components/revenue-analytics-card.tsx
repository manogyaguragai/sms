'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, DollarSign, UserPlus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RevenueAnalyticsCardProps {
  expectedMRR: number;
  collectedThisMonth: number;
  pendingFirstPayment: number;
}

interface MetricItemProps {
  label: string;
  value: string | number;
  tooltip: string;
  icon: React.ReactNode;
  valueColor?: string;
  isNegative?: boolean;
}

function MetricItem({ label, value, tooltip, icon, valueColor, isNegative }: MetricItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              type="button" 
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label={`Info about ${label}`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="max-w-[200px] text-center bg-gray-900 text-white"
          >
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isNegative ? "bg-red-50" : "bg-blue-50"
        )}>
          {icon}
        </div>
        <span className={cn(
          "text-lg sm:text-xl font-bold",
          valueColor || "text-gray-900"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}

export function RevenueAnalyticsCard({
  expectedMRR,
  collectedThisMonth,
  pendingFirstPayment,
}: RevenueAnalyticsCardProps) {
  const paymentGap = expectedMRR - collectedThisMonth;
  const isOverCollected = paymentGap < 0;

  return (
    <Card className="bg-white border-gray-200 shadow-sm col-span-1 md:col-span-2 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-full -translate-y-1/2 translate-x-1/2" />
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Revenue Analytics</h3>
            <p className="text-xs text-gray-500">Monthly overview</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <MetricItem
            label="Expected MRR"
            value={`Rs. ${expectedMRR.toFixed(0)}`}
            tooltip="Monthly revenue based on payment history of subscribers with at least one recorded payment"
            icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
          />
          
          <MetricItem
            label="Collected This Month"
            value={`Rs. ${collectedThisMonth.toFixed(0)}`}
            tooltip="Total payments received in the current calendar month"
            icon={<DollarSign className="w-4 h-4 text-green-600" />}
            valueColor="text-green-600"
          />
          
          <MetricItem
            label="Payment Gap"
            value={`${isOverCollected ? '+' : ''}Rs. ${Math.abs(paymentGap).toFixed(0)}`}
            tooltip="Difference between expected revenue and collected this month. Positive means over-collected."
            icon={isOverCollected 
              ? <TrendingUp className="w-4 h-4 text-green-600" /> 
              : <TrendingDown className="w-4 h-4 text-red-600" />
            }
            valueColor={isOverCollected ? "text-green-600" : "text-red-600"}
            isNegative={!isOverCollected && paymentGap > 0}
          />
          
          <MetricItem
            label="Pending First Payment"
            value={pendingFirstPayment}
            tooltip="Active subscribers who haven't made any payments yet"
            icon={<UserPlus className="w-4 h-4 text-amber-600" />}
            valueColor="text-amber-600"
          />
        </div>
      </CardContent>
    </Card>
  );
}
