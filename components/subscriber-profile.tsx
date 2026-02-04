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
} from 'lucide-react';
import { differenceInDays, subMonths, subYears, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { PaymentModal } from '@/components/payment-modal';
import { SubscriberForm } from '@/components/subscriber-form';
import type { Subscriber, Payment } from '@/lib/types';
import { updateSubscriptionDate, toggleSubscriberStatus } from '@/app/actions/subscriber';
import { formatNepaliDate, formatNepaliDateTime, toNepaliDateString, fromNepaliDateString, NEPALI_MONTHS } from '@/lib/nepali-date';

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
  const [deleting, setDeleting] = useState(false);
  const [newEndDate, setNewEndDate] = useState(() => toNepaliDateString(subscriber.subscription_end_date));
  const [updatingDate, setUpdatingDate] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Derived calculations - normalize to start of day for accurate day comparison
  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(subscriber.subscription_end_date));
  const daysRemaining = differenceInDays(endDate, today);
  
  // Calculate consumed days (Assuming simplified cycle based on frequency)
  const currentIntervalStart = subscriber.frequency === 'monthly' 
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
    <div className="p-6 lg:p-8 space-y-6">
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
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 bg-blue-600 text-xl shadow-lg ring-4 ring-white">
            <AvatarFallback className="bg-transparent text-white">
              {subscriber.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {subscriber.full_name}
              {subscriber.referred_by && (
                <span className="text-base font-normal text-gray-500 ml-2">
                  (Referred by {subscriber.referred_by})
                </span>
              )}
            </h1>
            <p className="text-gray-500">{subscriber.phone || 'No phone'}</p>
            <div className="flex items-center gap-2 mt-2">
              {getStatusBadge(subscriber.status)}
              <Badge variant="outline" className="border-gray-200 text-gray-600 capitalize">
                {subscriber.frequency}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          >
             {togglingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Power className="w-4 h-4 mr-2" />}
             {subscriber.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowEditModal(true)}
            className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            onClick={() => setShowPaymentModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rate Card */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rate</p>
              <p className="text-lg font-semibold text-gray-900">
                Rs. {Number(subscriber.monthly_rate).toFixed(2)}
                <span className="text-xs text-gray-400 ml-1">
                  /{subscriber.frequency === 'monthly' ? 'mo' : 'yr'}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Expires Card with details */}
        <Card className="bg-white border-gray-200 shadow-sm col-span-1 lg:col-span-2">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  daysRemaining <= 0
                    ? 'bg-red-50'
                    : daysRemaining <= 7
                    ? 'bg-amber-50'
                    : 'bg-green-50'
                }`}
              >
                <Clock
                  className={`w-5 h-5 ${
                    daysRemaining <= 0
                      ? 'text-red-600'
                      : daysRemaining <= 7
                      ? 'text-amber-600'
                      : 'text-green-600'
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-gray-500">Subscription Status</p>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-gray-900">
                    {daysRemaining <= 0 ? (
                      <span className="text-red-600">Expired</span>
                    ) : (
                      `${daysRemaining} days remaining`
                    )}
                  </p>
                  <Separator orientation="vertical" className="h-4 bg-gray-200" />
                   <p className="text-sm text-gray-500">
                     {daysConsumed > 0 ? daysConsumed : 0} days consumed
                   </p>
                </div>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="text-gray-400 hover:text-blue-600" onClick={() => setShowDateDialog(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <p className="text-sm text-gray-500">Subscription End Date</p>
              <p className="text-gray-900">
                {formatNepaliDate(subscriber.subscription_end_date, 'long')}
              </p>
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

        {/* Payment History */}
        <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <CreditCard className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500">No payments recorded yet</p>
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Record First Payment
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            Rs. {Number(payment.amount_paid).toFixed(2)}
                          </p>
                          {payment.notes && payment.notes.includes('Payment for:') && (
                            <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50">
                              For: {payment.notes.match(/Payment for:\s*([^|]+)/)?.[1]?.trim() || ''}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatNepaliDateTime(payment.payment_date)}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                        )}
                      </div>
                    </div>
                    {payment.proof_url && (
                      <a
                        href={payment.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Proof
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        subscriber={subscriber}
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
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
