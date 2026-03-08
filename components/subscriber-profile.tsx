'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { deleteSubscriber } from '@/app/actions/subscriber';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
  Bell,
  CreditCard,
  Edit,
  Trash2,
  Receipt,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Clock,
  Settings,
  ToggleLeft,
  ToggleRight,
  Power,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { differenceInDays, subMonths, subYears, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { PaymentModal } from '@/components/payment-modal';
import { PaymentDetailModal } from '@/components/payment-detail-modal';
import { SubscriberForm } from '@/components/subscriber-form';
import type { Subscriber, Payment } from '@/lib/types';
import { updateSubscriptionDate, toggleSubscriberStatus } from '@/app/actions/subscriber';
import { formatNepaliDate, formatNepaliDateTime, toNepaliDateString, fromNepaliDateString, NEPALI_MONTHS } from '@/lib/nepali-date';
import { PaymentPeriodCalendar } from '@/components/payment-period-calendar';
import { SubscriberStatement } from '@/components/subscriber-statement';
import { TotalPaymentCard } from '@/components/total-payment-card';

interface SubscriberProfileProps {
  subscriber: Subscriber;
  payments: Payment[];
}

export function SubscriberProfile({ subscriber, payments }: SubscriberProfileProps) {
  const router = useRouter();
  const { hasPermission } = useRole();
  const canDelete = hasPermission('DELETE_SUBSCRIBER');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showStatementDialog, setShowStatementDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newEndDate, setNewEndDate] = useState(() => toNepaliDateString(subscriber.subscription_end_date));
  const [updatingDate, setUpdatingDate] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Pagination state for payment history (per-frequency independent pages)
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const [recordsPerPage, setRecordsPerPage] = useState(5);


  // Derived calculations - normalize to start of day for accurate day comparison
  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(subscriber.subscription_end_date));
  const daysRemaining = differenceInDays(endDate, today);
  
  // Per-frequency end dates
  const endDates: Record<string, string> = subscriber.subscription_end_dates || {};

  // Calculate consumed days using soonest end date
  const soonestFreq = subscriber.frequency?.find(f => endDates[f]) || subscriber.frequency?.[0] || 'monthly';
  const currentIntervalStart = soonestFreq === 'monthly' 
    ? subMonths(endDate, 1) 
    : subYears(endDate, 1);
  const daysConsumed = differenceInDays(today, currentIntervalStart);

  const lastPaymentDate = payments.length > 0 ? new Date(payments[0].payment_date) : null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteSubscriber(subscriber.id);

      if (!result.success) {
        throw new Error(result.message);
      }

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
      // Convert Nepali date string to JS Date before saving
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
      // Logic handled via server action but we have to cast string to type if strict
      // assuming backend handles it safely or we cast
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-50 text-green-600 border-green-200 text-sm px-3 py-1">
            Active
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-red-50 text-red-600 border-red-200 text-sm px-3 py-1">
            Expired
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-sm px-3 py-1">
            Inactive
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-sm px-3 py-1">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        asChild
        className="text-gray-500 hover:text-gray-900 -ml-2"
      >
        <Link href="/subscribers">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Subscribers
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-8">
        {/* Left side - Name, badges, and buttons */}
        <div className="flex flex-col gap-2 min-w-0 flex-shrink-0">
          <div className="flex items-start gap-3 sm:gap-4">
            <Avatar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-600 text-base sm:text-lg md:text-xl shadow-lg ring-4 ring-white shrink-0">
              <AvatarFallback className="bg-transparent text-white">
                {subscriber.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">
                {subscriber.full_name}
              </h1>
              {subscriber.referred_by && (
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  Referred by {subscriber.referred_by}
                </p>
              )}
              <p className="text-gray-500 text-xs sm:text-sm">{subscriber.phone || 'No phone'}</p>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                {getStatusBadge(subscriber.status)}
                <Badge variant="outline" className="border-gray-200 text-gray-600 capitalize text-xs sm:text-sm">
                  {subscriber.frequency?.join(', ') || 'N/A'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action buttons - Full width on mobile */}
          <div className="grid grid-cols-2 sm:flex gap-2 mt-1">
            <Button
              variant="outline"
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-9 sm:h-10 text-xs sm:text-sm"
            >
              {togglingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-1 sm:mr-2" /> : <Power className="w-4 h-4 mr-1 sm:mr-2" />}
              <span className="hidden sm:inline">{subscriber.status === 'active' ? 'Deactivate' : 'Activate'}</span>
              <span className="sm:hidden">{subscriber.status === 'active' ? 'Off' : 'On'}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
              className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-9 sm:h-10 text-xs sm:text-sm"
            >
              <Edit className="w-4 h-4 mr-1 sm:mr-2" />
              Edit
            </Button>
            <Button
              onClick={() => setShowPaymentModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 sm:h-10 col-span-2 sm:col-span-1 text-xs sm:text-sm"
            >
              <CreditCard className="w-4 h-4 mr-1 sm:mr-2" />
              Record Payment
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowStatementDialog(true)}
              className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-9 sm:h-10 col-span-2 sm:col-span-1 text-xs sm:text-sm"
            >
              <Printer className="w-4 h-4 mr-1 sm:mr-2" />
              Statement
            </Button>
          </div>
        </div>

        {/* Payment Period Calendars - one per frequency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-stretch gap-3 lg:flex-1 lg:min-w-0">
          {(subscriber.frequency || []).map((freq) => (
            <div key={freq} className="lg:w-[320px] lg:flex-shrink-0">
              <PaymentPeriodCalendar
                payments={payments.filter(p => p.payment_for === freq)}
                frequency={[freq]}
                subscriptionEndDates={subscriber.subscription_end_dates}
                className="w-full h-full"
              />
            </div>
          ))}
          {/* Total Payment Summary */}
          <div className="lg:w-[260px] lg:flex-shrink-0">
            <TotalPaymentCard
              payments={payments}
              frequencies={subscriber.frequency || []}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Per-frequency Subscription Status Cards */}
        {(subscriber.frequency || []).map((freq) => {
          const date = endDates[freq];
          const freqLabel = freq === '12_hajar' ? '12 Hajar' : freq.charAt(0).toUpperCase() + freq.slice(1);
          const hasPayments = !!date;

          if (!hasPayments) {
            // No payments recorded for this frequency — show "Not started"
            return (
              <Card key={freq} className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100">
                      <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">{freqLabel} Subscription</p>
                      <p className="text-lg font-semibold text-gray-400">Not started</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        No payments recorded yet
                      </p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-gray-400 hover:text-blue-600" onClick={() => setShowDateDialog(true)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          }

          const freqDays = differenceInDays(startOfDay(new Date(date)), today);
          const freqIntervalStart = freq === 'monthly'
            ? subMonths(startOfDay(new Date(date)), 1)
            : subYears(startOfDay(new Date(date)), 1);
          const freqConsumed = differenceInDays(today, freqIntervalStart);

          return (
            <Card key={freq} className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${freqDays <= 0
                      ? 'bg-red-50'
                      : freqDays <= 7
                        ? 'bg-amber-50'
                        : 'bg-green-50'
                      }`}
                  >
                    <Clock
                      className={`w-5 h-5 ${freqDays <= 0
                        ? 'text-red-600'
                        : freqDays <= 7
                          ? 'text-amber-600'
                          : 'text-green-600'
                        }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">{freqLabel} Subscription</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <p className="text-base sm:text-lg font-semibold text-gray-900">
                        {freqDays <= 0 ? (
                          <span className="text-red-600">Expired</span>
                        ) : (
                          `${freqDays} days remaining`
                        )}
                      </p>
                      <Separator orientation="vertical" className="h-4 bg-gray-200 hidden sm:block" />
                      <p className="text-xs sm:text-sm text-gray-500">
                        {freqConsumed > 0 ? freqConsumed : 0} days consumed
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Ends: {formatNepaliDate(date, 'short')}
                    </p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="text-gray-400 hover:text-blue-600" onClick={() => setShowDateDialog(true)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {/* Fallback: if no end dates but subscriber has frequency */}
        {Object.keys(endDates).length === 0 && (
          <Card className="bg-white border-gray-200 shadow-sm col-span-1 lg:col-span-2">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${daysRemaining <= 0
                    ? 'bg-red-50'
                    : daysRemaining <= 7
                      ? 'bg-amber-50'
                      : 'bg-green-50'
                    }`}
                >
                  <Clock
                    className={`w-5 h-5 ${daysRemaining <= 0
                      ? 'text-red-600'
                      : daysRemaining <= 7
                        ? 'text-amber-600'
                        : 'text-green-600'
                      }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subscription Status</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {daysRemaining <= 0 ? (
                      <span className="text-red-600">Expired</span>
                    ) : (
                      `${daysRemaining} days remaining`
                    )}
                  </p>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-blue-600" onClick={() => setShowDateDialog(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Last Paid Date */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Paid</p>
              <p className="text-lg font-semibold text-gray-900">
                {lastPaymentDate ? formatNepaliDate(lastPaymentDate, 'short') : 'No payments'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details & Payment History */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Contact Info */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriber.email ? (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${subscriber.email}`}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {subscriber.email}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">No email provided</span>
              </div>
            )}
            {subscriber.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{subscriber.phone}</span>
              </div>
            )}
            <Separator className="bg-gray-200" />
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Subscription End Dates</p>
              {(subscriber.frequency || []).map((freq) => {
                const freqLabel = freq === '12_hajar' ? '12 Hajar' : freq.charAt(0).toUpperCase() + freq.slice(1);
                const date = endDates[freq];
                return (
                  <div key={freq} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{freqLabel}:</span>
                    <span className="text-gray-900 text-sm">
                      {date ? formatNepaliDate(date, 'long') : <span className="text-gray-400">Not started</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="text-gray-900">
                {formatNepaliDate(subscriber.created_at, 'long')}
              </p>
            </div>
            <Separator className="bg-gray-200" />
            {canDelete && (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Subscriber
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Payment History — Separate cards per subscription */}
        {(() => {
          const frequencies = subscriber.frequency || [];
          const untaggedPayments = payments.filter(p => !p.payment_for);
          const hasUntagged = untaggedPayments.length > 0;
          const getFreqLabel = (f: string) => f === 'monthly' ? 'Monthly' : f === 'annually' ? 'Annually' : f === '12_hajar' ? '12 Hajar' : f;

          const columns = [
            ...frequencies.map(f => ({
              key: f,
              label: `Payment for ${getFreqLabel(f)}`,
              payments: payments.filter(p => p.payment_for === f),
            })),
            ...(hasUntagged ? [{ key: '_other', label: 'Other Payments', payments: untaggedPayments }] : []),
          ];

          const getPage = (key: string) => currentPages[key] || 1;
          const setPage = (key: string, page: number) => setCurrentPages(prev => ({ ...prev, [key]: page }));

          return columns.map(col => {
            const colPage = getPage(col.key);
            const colTotalPages = Math.ceil(col.payments.length / recordsPerPage);
            const colStart = (colPage - 1) * recordsPerPage;
            const colEnd = colStart + recordsPerPage;
            const colPaginated = col.payments.slice(colStart, colEnd);

            return (
              <Card key={col.key} className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-gray-900 text-base flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      {col.label}
                      {col.payments.length > 0 && (
                        <span className="text-sm font-normal text-gray-500">
                          ({col.payments.length})
                        </span>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {col.payments.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <CreditCard className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">No payments yet</p>
                    </div>
                  ) : (
                      <div className="space-y-2">
                        {colPaginated.map((payment) => (
                          <div
                            key={payment.id}
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowPaymentDetailModal(true);
                            }}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors gap-2 sm:gap-3"
                          >
                            <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
                              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                                <DollarSign className="w-4 h-4 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-gray-900 text-sm">
                                    Rs. {Number(payment.amount_paid).toFixed(2)}
                                  </p>
                                  {payment.notes && payment.notes.includes('Payment for:') && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-blue-200 text-blue-700 bg-blue-50 max-w-[160px] truncate block"
                                      title={payment.notes.match(/Payment for:\s*([^|]+)/)?.[1]?.trim() || ''}
                                    >
                                      {payment.notes.match(/Payment for:\s*([^|]+)/)?.[1]?.trim() || ''}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {formatNepaliDateTime(payment.payment_date)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-11 sm:ml-0 self-start sm:self-auto">
                              {payment.proof_url && (
                                <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                                  Proof
                                </Badge>
                              )}
                              {payment.receipt_number && (
                                <Badge variant="outline" className="text-xs border-gray-200 text-gray-600 bg-white">
                                  Receipt
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Pagination */}
                        {colTotalPages > 1 && (
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                              {colStart + 1}-{Math.min(colEnd, col.payments.length)} of {col.payments.length}
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(col.key, Math.max(1, colPage - 1))}
                                disabled={colPage === 1}
                                className="h-7 w-7 p-0"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </Button>
                              <span className="text-xs text-gray-600 px-1">
                                {colPage}/{colTotalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(col.key, Math.min(colTotalPages, colPage + 1))}
                                disabled={colPage === colTotalPages}
                                className="h-7 w-7 p-0"
                              >
                              <ChevronRight className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          });
        })()}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        subscriber={subscriber}
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
      />

      {/* Subscriber Statement */}
      <SubscriberStatement
        subscriber={subscriber}
        open={showStatementDialog}
        onClose={() => setShowStatementDialog(false)}
      />

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        payment={selectedPayment}
        open={showPaymentDetailModal}
        onClose={() => {
          setShowPaymentDetailModal(false);
          setSelectedPayment(null);
        }}
        subscriberFrequencies={subscriber.frequency || []}
      />

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-white border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Subscriber</DialogTitle>
            <DialogDescription className="text-gray-500">
              Update the subscriber information below.
            </DialogDescription>
          </DialogHeader>
          <SubscriberForm subscriber={subscriber} mode="edit" />
        </DialogContent>
      </Dialog>
      
      {/* Date Update Modal */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="bg-white border-gray-200">
           <DialogHeader>
            <DialogTitle className="text-gray-900">Adjust Subscription Date</DialogTitle>
            <DialogDescription className="text-gray-500">
              Manually update the subscription end date for {subscriber.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-sm text-gray-600">
              Enter date in B.S. format (YYYY-MM-DD)
            </label>
            <Input 
              type="text"
              placeholder="2082-10-12"
              value={newEndDate} 
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Example: 2082-10-12 for Magh 12, 2082
            </p>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setShowDateDialog(false)} className="text-gray-600">Cancel</Button>
             <Button onClick={handleUpdateDate} disabled={updatingDate} className="bg-blue-600 text-white hover:bg-blue-700">
                {updatingDate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Date
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete Subscriber
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to delete <strong>{subscriber.full_name}</strong>? This
              action cannot be undone and will also delete all {payments.length} associated
              payment records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
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
                'Delete Subscriber'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
