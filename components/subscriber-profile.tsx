'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { deleteSubscriber } from '@/app/actions/subscriber';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  CreditCard,
  Edit,
  Trash2,
  Receipt,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Clock,
  Settings,
  Power,
  ChevronLeft,
  ChevronRight,
  Printer,
  CalendarDays,
  TrendingUp,
  User,
  IdCard,
  PhoneCall,
} from 'lucide-react';
import { differenceInDays, startOfDay } from 'date-fns';
import NepaliDate from 'nepali-date-converter';
import { toast } from 'sonner';
import { PaymentModal } from '@/components/payment-modal';
import { PaymentDetailModal } from '@/components/payment-detail-modal';
import { SubscriberForm } from '@/components/subscriber-form';
import type { Subscriber, Payment } from '@/lib/types';
import { updateSubscriptionDate, toggleSubscriberStatus } from '@/app/actions/subscriber';
import { formatNepaliDate, formatNepaliDateTime, toNepaliDateString, fromNepaliDateString } from '@/lib/nepali-date';
import { PaymentPeriodCalendar } from '@/components/payment-period-calendar';
import { SubscriberStatement } from '@/components/subscriber-statement';
import { TotalPaymentCard } from '@/components/total-payment-card';
import { IdCardModal } from '@/components/id-card-modal';
import { SubscriberFollowupsModal } from '@/components/subscriber-followups-modal';

// Nepali month names for parsing payment notes
const NEPALI_MONTH_NAMES = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

/**
 * Parse all Nepali month/year periods from a payment's notes field.
 * e.g. "Payment for: Poush 2082, Magh 2082" → [{month:8, year:2082}, {month:9, year:2082}]
 */
function parsePeriodsFromNotes(notes: string): { month: number; year: number }[] {
  const results: { month: number; year: number }[] = [];
  const regex = /([A-Za-z]+)\s+(\d{4})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(notes)) !== null) {
    const monthIndex = NEPALI_MONTH_NAMES.findIndex(
      m => m.toLowerCase() === match![1].toLowerCase()
    );
    const year = parseInt(match![2], 10);
    if (monthIndex !== -1 && !isNaN(year)) {
      results.push({ month: monthIndex, year });
    }
  }
  return results;
}

/**
 * From a list of payments for a frequency, find the earliest paid Nepali month
 * and return its start date (1st of that month) as a JS Date.
 */
function getSubscriptionStartDate(freqPayments: Payment[]): Date | null {
  const allPeriods: { month: number; year: number }[] = [];

  for (const p of freqPayments) {
    if (p.notes) {
      const periods = parsePeriodsFromNotes(p.notes);
      allPeriods.push(...periods);
    }
    // Fallback: try payment_for_period date
    if (allPeriods.length === 0 && p.payment_for_period) {
      try {
        const nd = new NepaliDate(new Date(p.payment_for_period));
        allPeriods.push({ month: nd.getMonth(), year: nd.getYear() });
      } catch { /* ignore */ }
    }
  }

  if (allPeriods.length === 0) return null;

  // Deduplicate and find earliest
  const seen = new Set<string>();
  const unique = allPeriods.filter(p => {
    const key = `${p.year}-${p.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const earliest = unique[0];

  try {
    return new NepaliDate(earliest.year, earliest.month, 1).toJsDate();
  } catch {
    return null;
  }
}

interface SubscriberProfileProps {
  subscriber: Subscriber;
  payments: Payment[];
  canCreateFollowup: boolean;
}

export function SubscriberProfile({ subscriber, payments, canCreateFollowup }: SubscriberProfileProps) {
  const router = useRouter();
  const { hasPermission } = useRole();
  const canDelete = hasPermission('DELETE_SUBSCRIBER');
  const canCreatePayment = hasPermission('CREATE_PAYMENT');
  const canEdit = hasPermission('UPDATE_SUBSCRIBER');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showStatementDialog, setShowStatementDialog] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [showFollowupsModal, setShowFollowupsModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newEndDate, setNewEndDate] = useState(() => toNepaliDateString(subscriber.subscription_end_date));
  const [updatingDate, setUpdatingDate] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const recordsPerPage = 5;

  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(subscriber.subscription_end_date));
  const daysRemaining = differenceInDays(endDate, today);
  const endDates: Record<string, string> = subscriber.subscription_end_dates || {};

  const lastPaymentDate = payments.length > 0 ? new Date(payments[0].payment_date) : null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteSubscriber(subscriber.id);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      router.push('/subscribers');
    } catch (error: any) {
      console.error('Error deleting subscriber:', error);
      toast.error(error.message || 'Failed to delete subscriber');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleUpdateDate = async () => {
    setUpdatingDate(true);
    try {
      const jsDate = fromNepaliDateString(newEndDate);
      const result = await updateSubscriptionDate(subscriber.id, jsDate.toISOString());
      if (result.success) {
        toast.success(result.message);
        setShowDateDialog(false);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Failed to update date");
    } finally {
      setUpdatingDate(false);
    }
  };

  const handleToggleStatus = async () => {
    setTogglingStatus(true);
    const newStatus = subscriber.status === 'active' ? 'inactive' : 'active';
    try {
      const result = await toggleSubscriberStatus(subscriber.id, newStatus as any);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  };

  const frequencies = subscriber.frequency || [];
  const untaggedPayments = payments.filter(p => !p.payment_for);
  const hasUntagged = untaggedPayments.length > 0;
  const getFreqLabel = (f: string) => f === 'monthly' ? 'Monthly' : f === 'annually' ? 'Annually' : f === '12_hajar' ? '12 Hajar' : f;

  const statusConfig = {
    active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
    expired: { label: 'Expired', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', ring: 'ring-red-500/20' },
    inactive: { label: 'Inactive', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', ring: 'ring-slate-400/20' },
    cancelled: { label: 'Cancelled', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', ring: 'ring-slate-400/20' },
  };
  const status = statusConfig[subscriber.status as keyof typeof statusConfig] || statusConfig.inactive;

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Back */}
      <Button variant="ghost" asChild className="text-slate-400 hover:text-slate-700 -ml-2 h-8 px-3 text-sm">
        <Link href="/subscribers">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Subscribers
        </Link>
      </Button>

      {/* ── Profile Header ── */}
      <div className="relative bg-gradient-to-br from-white via-white to-blue-50/40 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Accent stripe */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500" />

        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/25">
                <AvatarFallback className="bg-transparent text-white text-lg font-bold rounded-xl">
                  {subscriber.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {/* Status dot overlaid on avatar */}
              <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${status.dot} border-2 border-white ring-2 ${status.ring}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                  {subscriber.full_name}
                </h1>
                <span className="text-sm font-mono font-extrabold text-blue-700 bg-blue-100 border-2 border-blue-300 px-3 py-1 rounded-lg shrink-0 tracking-wide shadow-sm">
                  {subscriber.master_id}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 flex-wrap">
                {subscriber.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {subscriber.phone}
                  </span>
                )}
                {subscriber.phone && frequencies.length > 0 && <span className="text-slate-200">·</span>}
                {frequencies.length > 0 && (
                  <span className="capitalize font-medium text-blue-600/80">{frequencies.map(getFreqLabel).join(', ')}</span>
                )}
                {subscriber.referred_by && (
                  <>
                    <span className="text-slate-200">·</span>
                    <span className="text-slate-400">Ref: {subscriber.referred_by}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {canCreatePayment && (
              <Button
                onClick={() => setShowPaymentModal(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white h-9 px-5 text-sm font-semibold shadow-md shadow-blue-600/25 transition-all hover:shadow-lg hover:shadow-blue-600/30"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Record Payment
              </Button>
            )}
            <div className="flex items-center gap-1.5">
              {canEdit && (
                <Button variant="outline" onClick={() => setShowEditModal(true)} className="h-9 px-3 border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
                  <Edit className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" onClick={handleToggleStatus} disabled={togglingStatus} className="h-9 px-3 border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
                  {togglingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin sm:mr-1.5" /> : <Power className="w-3.5 h-3.5 sm:mr-1.5" />}
                  <span className="hidden sm:inline">{subscriber.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowStatementDialog(true)} className="h-9 px-3 border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
                <Printer className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Statement</span>
              </Button>
              <Button variant="outline" onClick={() => setShowIdCardModal(true)} className="h-9 px-3 border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
                <IdCard className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">ID Card</span>
              </Button>
              <Button variant="outline" onClick={() => setShowFollowupsModal(true)} className="h-9 px-3 border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
                <PhoneCall className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Followups</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── Left Sidebar ── */}
        <div className="w-full lg:w-[300px] flex-shrink-0 space-y-4">

          {/* At a Glance */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">At a Glance</h3>
            </div>
            <div className="p-4 space-y-0 divide-y divide-slate-50">
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <span className="text-xs font-medium text-slate-400">Last Payment</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  {lastPaymentDate ? formatNepaliDate(lastPaymentDate, 'short') : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-400">Member Since</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  {formatNepaliDate(subscriber.created_at, 'short')}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-xs font-medium text-slate-400">Total Payments</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">{payments.length}</span>
              </div>
              {subscriber.email && (
                <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">Email</span>
                  </div>
                  <a href={`mailto:${subscriber.email}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate max-w-[140px] transition-colors">
                    {subscriber.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Financials */}
          <TotalPaymentCard
            payments={payments}
            frequencies={subscriber.frequency || []}
            className="w-full rounded-2xl border-slate-200/80 shadow-sm"
          />

          {/* Delete */}
          {canDelete && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50/60 transition-all duration-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete subscriber
            </button>
          )}
        </div>

        {/* ── Right Main Content ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ── Subscription Status ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Subscriptions
            </h2>

            <div className="grid gap-4">
              {frequencies.map((freq) => {
                const date = endDates[freq];
                const freqLabel = getFreqLabel(freq);
                const hasPayments = !!date;

                if (!hasPayments) {
                  return (
                    <div key={freq} className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
                          <Clock className="w-3.5 h-3.5" />
                          {freqLabel}
                        </span>
                        <p className="text-lg font-semibold text-slate-300">Not started</p>
                        <p className="text-sm text-slate-400 mt-0.5">Record a payment to begin tracking</p>
                      </div>
                      {canEdit && (
                        <Button variant="outline" size="sm" className="border-slate-200 text-slate-400 hover:text-slate-600" onClick={() => setShowDateDialog(true)}>
                          <Settings className="w-3.5 h-3.5 mr-1.5" /> Set Date
                        </Button>
                      )}
                    </div>
                  );
                }

                const freqEndDate = startOfDay(new Date(date));
                const freqDays = differenceInDays(freqEndDate, today);

                // Compute elapsed/total based on actual paid periods
                // Total = days from first paid period start to subscription end
                // Elapsed = days from first paid period start to today
                const freqPayments = payments.filter(p => p.payment_for === freq);
                const subscriptionStart = getSubscriptionStartDate(freqPayments);

                let totalInterval: number;
                let freqConsumed: number;

                if (subscriptionStart) {
                  const startDay = startOfDay(subscriptionStart);
                  totalInterval = Math.max(differenceInDays(freqEndDate, startDay), 1);
                  freqConsumed = Math.max(differenceInDays(today, startDay), 0);
                  // Clamp: don't exceed total (handles expired subs)
                  freqConsumed = Math.min(freqConsumed, totalInterval);
                } else {
                  // No parsed periods — fallback to simple remaining-based estimate
                  totalInterval = freq === 'monthly' ? 30 : 365;
                  freqConsumed = Math.max(totalInterval - Math.max(freqDays, 0), 0);
                }

                const progressPercent = totalInterval > 0 ? Math.min(Math.max((freqConsumed / totalInterval) * 100, 0), 100) : 0;

                const isExpired = freqDays <= 0;
                const isWarning = freqDays <= 7 && !isExpired;

                const barColor = isExpired ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-blue-500';
                const barBg = isExpired ? 'bg-red-100' : isWarning ? 'bg-amber-100' : 'bg-blue-100';

                return (
                  <div key={freq} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
                    <div className="flex flex-col xl:flex-row">

                      {/* Left: Status */}
                      <div className="xl:w-[360px] p-6 flex flex-col justify-between border-b xl:border-b-0 xl:border-r border-slate-100/80">
                        <div>
                          <div className="flex items-center justify-between mb-5">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{freqLabel}</span>
                            {canEdit && (
                              <button
                                onClick={() => setShowDateDialog(true)}
                                className="text-slate-300 hover:text-slate-500 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
                                title="Adjust date"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Big number */}
                          <div className="flex items-baseline gap-2 mb-6">
                            <span className={`text-5xl font-black tracking-tighter tabular-nums leading-none ${isExpired ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-900'}`}>
                              {isExpired ? '0' : freqDays}
                            </span>
                            <span className="text-sm font-medium text-slate-400 pb-1">
                              {isExpired ? 'expired' : freqDays === 1 ? 'day left' : 'days left'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="mb-6">
                            <div className={`w-full h-2 rounded-full ${barBg} overflow-hidden`}>
                              <div
                                className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1.5">
                              <span className="text-[11px] text-slate-400">{freqConsumed}d elapsed</span>
                              <span className="text-[11px] text-slate-400">{totalInterval}d total</span>
                            </div>
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="space-y-2 pt-4 border-t border-slate-100/80">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Valid until</span>
                            <span className="text-slate-700 font-semibold">{formatNepaliDate(date, 'long')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Calendar */}
                      <div className="xl:flex-1 p-5 sm:p-6 flex items-center justify-center bg-slate-50/30">
                        <div className="w-full max-w-[300px]">
                          <PaymentPeriodCalendar
                            payments={payments.filter(p => p.payment_for === freq)}
                            frequency={[freq]}
                            subscriptionEndDates={subscriber.subscription_end_dates}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Legacy fallback */}
              {Object.keys(endDates).length === 0 && frequencies.length > 0 && payments.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subscription</span>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {daysRemaining <= 0 ? <span className="text-red-500">Expired</span> : `${daysRemaining} days left`}
                    </p>
                  </div>
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setShowDateDialog(true)}>
                      <Settings className="w-3.5 h-3.5 mr-1.5" /> Adjust
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Payment History ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Payment History
            </h2>

            <Tabs defaultValue={frequencies[0] || '_other'} className="w-full">
              <TabsList className="bg-slate-100/80 p-1 rounded-xl h-auto w-full justify-start overflow-x-auto flex-nowrap border border-slate-200/50">
                {frequencies.map(f => (
                  <TabsTrigger
                    key={f}
                    value={f}
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-400 font-medium whitespace-nowrap px-4 py-2 text-sm transition-all"
                  >
                    {getFreqLabel(f)}
                  </TabsTrigger>
                ))}
                {hasUntagged && (
                  <TabsTrigger
                    value="_other"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-400 font-medium whitespace-nowrap px-4 py-2 text-sm transition-all"
                  >
                    Other
                  </TabsTrigger>
                )}
              </TabsList>

              {[...frequencies, ...(hasUntagged ? ['_other'] : [])].map(freqKey => {
                const colPayments = freqKey === '_other' ? untaggedPayments : payments.filter(p => p.payment_for === freqKey);
                const colPage = currentPages[freqKey] || 1;
                const colTotalPages = Math.ceil(colPayments.length / recordsPerPage);
                const colStart = (colPage - 1) * recordsPerPage;
                const colEnd = colStart + recordsPerPage;
                const colPaginated = colPayments.slice(colStart, colEnd);

                return (
                  <TabsContent key={freqKey} value={freqKey} className="mt-3 focus-visible:outline-none">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                      {colPayments.length === 0 ? (
                        <div className="text-center py-16 px-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                            <Receipt className="w-6 h-6 text-slate-200" />
                          </div>
                          <p className="text-sm font-medium text-slate-300">No payment records</p>
                        </div>
                      ) : (
                          <div>
                            {/* Rows */}
                            <div className="divide-y divide-slate-100/80">
                              {colPaginated.map((payment, i) => (
                                <div
                                  key={payment.id}
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowPaymentDetailModal(true);
                                  }}
                                  className="flex items-center justify-between px-5 py-4 hover:bg-blue-50/30 transition-all duration-200 cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                      <DollarSign className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-900">
                                          Rs. {Number(payment.amount_paid).toLocaleString('en-NP')}
                                        </span>
                                        {payment.receipt_number && (
                                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                            #{payment.receipt_number}
                                          </span>
                                        )}
                                        {payment.proof_url && (
                                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                            Proof
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {formatNepaliDateTime(payment.payment_date)}
                                      </p>
                                      {payment.notes && payment.notes.includes('Payment for:') && (
                                        <p className="text-[11px] text-blue-500/70 mt-0.5 truncate max-w-[320px]">
                                          {payment.notes.match(/Payment for:\s*([^|]+)/)?.[1]?.trim() || ''}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors shrink-0" />
                                </div>
                              ))}
                            </div>
                          </div>
                      )}

                      {/* Pagination */}
                      {colTotalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100/80 bg-slate-50/30">
                          <p className="text-xs text-slate-400 tabular-nums">
                            {colStart + 1}–{Math.min(colEnd, colPayments.length)} of {colPayments.length}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCurrentPages(prev => ({ ...prev, [freqKey]: Math.max(1, colPage - 1) }))}
                              disabled={colPage === 1}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <span className="text-xs text-slate-400 px-1.5 tabular-nums font-medium">{colPage}/{colTotalPages}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCurrentPages(prev => ({ ...prev, [freqKey]: Math.min(colTotalPages, colPage + 1) }))}
                              disabled={colPage === colTotalPages}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <PaymentModal subscriber={subscriber} open={showPaymentModal} onClose={() => setShowPaymentModal(false)} />
      <SubscriberStatement subscriber={subscriber} open={showStatementDialog} onClose={() => setShowStatementDialog(false)} />
      <IdCardModal subscriber={subscriber} open={showIdCardModal} onClose={() => setShowIdCardModal(false)} />
      <SubscriberFollowupsModal
        subscriberId={subscriber.id}
        subscriberName={subscriber.full_name}
        open={showFollowupsModal}
        onClose={() => setShowFollowupsModal(false)}
        canCreateFollowup={canCreateFollowup}
      />
      <PaymentDetailModal
        payment={selectedPayment}
        open={showPaymentDetailModal}
        onClose={() => { setShowPaymentDetailModal(false); setSelectedPayment(null); }}
        subscriberFrequencies={subscriber.frequency || []}
      />

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-white border-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Edit Subscriber</DialogTitle>
            <DialogDescription className="text-slate-500">Update the subscriber information below.</DialogDescription>
          </DialogHeader>
          <SubscriberForm subscriber={subscriber} mode="edit" />
        </DialogContent>
      </Dialog>

      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Adjust Subscription Date</DialogTitle>
            <DialogDescription className="text-slate-500">
              Manually update the subscription end date for {subscriber.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2.5">
            <label className="text-sm font-medium text-slate-700">Date in B.S. (YYYY-MM-DD)</label>
            <Input type="text" placeholder="2082-10-12" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="w-full" />
            <p className="text-xs text-slate-400">Example: 2082-10-12 for Magh 12, 2082</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)} className="text-slate-500 border-slate-200">Cancel</Button>
            <Button onClick={handleUpdateDate} disabled={updatingDate} className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20">
              {updatingDate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              Delete Subscriber
            </DialogTitle>
            <DialogDescription className="text-slate-500 pt-1">
              Are you sure you want to delete <strong className="text-slate-900">{subscriber.full_name}</strong>? This
              action cannot be undone and will also delete all <strong className="text-slate-900">{payments.length}</strong> associated
              payment records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="text-slate-500 border-slate-200">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 shadow-sm">
              {deleting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>) : 'Delete Subscriber'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
