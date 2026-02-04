import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
  iconBgClassName?: string;
  href?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  valueClassName,
  iconClassName,
  iconBgClassName,
  href,
}: StatsCardProps) {
  const cardContent = (
    <Card className={cn(
      'bg-white border-gray-200 shadow-sm relative overflow-hidden',
      href && 'cursor-pointer hover:shadow-md hover:border-blue-300 transition-all',
      className
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -translate-y-1/2 translate-x-1/2" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className={cn("text-3xl font-bold text-gray-900", valueClassName)}>{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                'inline-flex items-center text-xs font-medium px-2 py-1 rounded-full',
                trend.positive
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              )}>
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          <div className={cn("w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0", iconBgClassName)}>
            <Icon className={cn("w-6 h-6 text-blue-600", iconClassName)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}
