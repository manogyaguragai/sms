'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { updatePayment, deletePayment } from '@/app/actions/subscriber';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Calendar, 
  Receipt, 
  CreditCard, 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  Edit,
  Loader2,
  X,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Payment } from '@/lib/types';
import { formatNepaliDateTime } from '@/lib/nepali-date';
import { NepaliDateTimePicker } from '@/components/nepali-datetime-picker';
import NepaliDate from 'nepali-date-converter';
import { NEPALI_MONTHS } from '@/lib/nepali-date';

interface PaymentDetailModalProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
}

interface SelectedPeriod {
  month: number;
  year: number;
}

export function PaymentDetailModal({ payment, open, onClose }: PaymentDetailModalProps) {
  const router = useRouter();
  const { hasPermission } = useRole();
  const canEdit = hasPermission('UPDATE_PAYMENT');
  const canDelete = hasPermission('DELETE_PAYMENT');

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit state
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState<Date>(new Date());
  const [selectedPeriods, setSelectedPeriods] = useState<SelectedPeriod[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editReceiptNumber, setEditReceiptNumber] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState<'online_transfer' | 'physical_transfer' | ''>('');

  // Calendar state
  const currentNepali = useMemo(() => new NepaliDate(new Date()), []);
  const [calendarYear, setCalendarYear] = useState(currentNepali.getYear());

  // Helper to extract period and notes from payment.notes
  const extractPeriodAndNotes = (notesStr: string | null): { periods: SelectedPeriod[], notes: string } => {
    if (!notesStr) return { periods: [], notes: '' };
    const periodMatch = notesStr.match(/Payment for:\s*([^|]+)/);
    const periodStr = periodMatch?.[1]?.trim() || '';
    const notes = notesStr.replace(/\|?\s*Payment for:\s*[^|]+/g, '').trim();

    const periods: SelectedPeriod[] = [];
    if (periodStr) {
      const parts = periodStr.split(',').map(p => p.trim());
      for (const part of parts) {
        const match = part.match(/([A-Za-z]+)\s+(\d{4})/);
        if (match) {
          const monthIndex = NEPALI_MONTHS.findIndex(m => m.toLowerCase() === match[1].toLowerCase());
          const year = parseInt(match[2], 10);
          if (monthIndex !== -1 && !isNaN(year)) {
            periods.push({ month: monthIndex, year });
          }
        }
      }
    }

    return { periods, notes };
  };

  // Reset edit state when payment changes or modal opens
  useEffect(() => {
    if (payment && open) {
      const { periods, notes } = extractPeriodAndNotes(payment.notes);
      setEditAmount(String(payment.amount_paid));
      setEditPaymentDate(new Date(payment.payment_date));
      setSelectedPeriods(periods);
      setEditNotes(notes);
      setEditReceiptNumber(payment.receipt_number || '');
      setEditPaymentMode(payment.payment_mode || '');
      setIsEditing(false);
      // Set calendar to first selected period year or current year
      if (periods.length > 0) {
        setCalendarYear(periods[0].year);
      } else {
        setCalendarYear(currentNepali.getYear());
      }
    }
  }, [payment, open, currentNepali]);

  if (!payment) return null;

  // Extract payment period from notes for display
  const periodMatch = payment.notes?.match(/Payment for:\s*([^|]+)/);
  const paymentPeriod = periodMatch?.[1]?.trim();

  // Get notes without the period info for display
  const notesWithoutPeriod = payment.notes?.replace(/\|?\s*Payment for:\s*[^|]+/g, '').trim();

  const getPaymentModeLabel = (mode: string | null) => {
    switch (mode) {
      case 'online_transfer':
        return 'Online Transfer';
      case 'physical_transfer':
        return 'Physical Transfer';
      default:
        return 'Not specified';
    }
  };

  // Build notes string from periods and notes
  const buildNotesString = (periods: SelectedPeriod[], notes: string) => {
    if (periods.length === 0) return notes || undefined;
    const periodStr = periods.map(p => `${NEPALI_MONTHS[p.month]} ${p.year}`).join(', ');
    if (notes) {
      return `${notes} | Payment for: ${periodStr}`;
    }
    return `Payment for: ${periodStr}`;
  };

  // Toggle month selection
  const toggleMonth = (monthIndex: number) => {
    const existing = selectedPeriods.find(p => p.month === monthIndex && p.year === calendarYear);
    if (existing) {
      setSelectedPeriods(selectedPeriods.filter(p => !(p.month === monthIndex && p.year === calendarYear)));
    } else {
      setSelectedPeriods([...selectedPeriods, { month: monthIndex, year: calendarYear }]);
    }
  };

  const isMonthSelected = (monthIndex: number) => {
    return selectedPeriods.some(p => p.month === monthIndex && p.year === calendarYear);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const combinedNotes = buildNotesString(selectedPeriods, editNotes);

      const result = await updatePayment(payment.id, payment.subscriber_id, {
        amount_paid: parseFloat(editAmount),
        payment_date: editPaymentDate.toISOString(),
        notes: combinedNotes,
        receipt_number: editReceiptNumber || null,
        payment_mode: editPaymentMode || null,
      });

      if (result.success) {
        toast.success(result.message);
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deletePayment(payment.id, payment.subscriber_id);
      if (result.success) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete payment');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    const { periods, notes } = extractPeriodAndNotes(payment.notes);
    setEditAmount(String(payment.amount_paid));
    setEditPaymentDate(new Date(payment.payment_date));
    setSelectedPeriods(periods);
    setEditNotes(notes);
    setEditReceiptNumber(payment.receipt_number || '');
    setEditPaymentMode(payment.payment_mode || '');
    setIsEditing(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-white border-gray-200 w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                {isEditing ? 'Edit Payment' : 'Payment Details'}
              </DialogTitle>
              <div className="flex items-center gap-1">
                {canDelete && !isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                {canEdit && !isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="text-gray-600 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount */}
            {isEditing ? (
              <div className="space-y-2">
                <Label className="text-gray-700">Amount Paid *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 font-medium">Rs.</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="pl-12 bg-white border-gray-300 text-gray-900"
                  />
                </div>
              </div>
            ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount Paid</p>
                    <p className="text-xl font-semibold text-gray-900">
                      Rs. {Number(payment.amount_paid).toFixed(2)}
                    </p>
                  </div>
                </div>
            )}

            <Separator className="bg-gray-200" />

            {/* Payment Period */}
            {isEditing ? (
              <div className="space-y-2">
                <Label className="text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Payment For (Period)
                </Label>

                {/* Month Calendar Selector */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {/* Year Navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCalendarYear(y => y - 1)}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-gray-800 text-sm">{calendarYear} B.S.</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCalendarYear(y => y + 1)}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Month Grid */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {NEPALI_MONTHS.map((month, index) => {
                      const selected = isMonthSelected(index);
                      return (
                        <button
                          key={month}
                          type="button"
                          onClick={() => toggleMonth(index)}
                          className={`
                            py-1.5 px-1 text-xs font-medium rounded border transition-all
                            ${selected
                              ? 'bg-blue-500 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'}
                          `}
                        >
                          {month.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Summary */}
                  {selectedPeriods.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500">Selected: {selectedPeriods.map(p => `${NEPALI_MONTHS[p.month]} ${p.year}`).join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : paymentPeriod ? (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-500 mb-1.5">Payment For</p>
                  <div className="flex flex-wrap gap-1.5">
                    {paymentPeriod.includes(',') ? (
                      paymentPeriod.split(',').map((period, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 whitespace-nowrap"
                        >
                          {period.trim()}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 whitespace-normal text-left leading-normal">
                        {paymentPeriod}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Payment Date */}
            {isEditing ? (
              <div className="space-y-2">
                <Label className="text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Payment Date
                </Label>
                <NepaliDateTimePicker
                  value={editPaymentDate}
                  onChange={setEditPaymentDate}
                  className="w-full"
                />
              </div>
            ) : (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Payment Date</p>
                    <p className="text-gray-900">{formatNepaliDateTime(payment.payment_date)}</p>
                  </div>
                </div>
            )}

            {/* Receipt Number */}
            {isEditing ? (
              <div className="space-y-2">
                <Label className="text-gray-700 flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Receipt Number
                </Label>
                <Input
                  placeholder="e.g., REC-001234"
                  value={editReceiptNumber}
                  onChange={(e) => setEditReceiptNumber(e.target.value)}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            ) : payment.receipt_number ? (
              <div className="flex items-start gap-3">
                <Receipt className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Receipt Number</p>
                  <p className="text-gray-900 font-mono">{payment.receipt_number}</p>
                </div>
              </div>
            ) : null}

            {/* Payment Mode */}
            {isEditing ? (
              <div className="space-y-2">
                <Label className="text-gray-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment Mode
                </Label>
                <Select
                  value={editPaymentMode}
                  onValueChange={(value: 'online_transfer' | 'physical_transfer') => setEditPaymentMode(value)}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online_transfer">Online Transfer</SelectItem>
                    <SelectItem value="physical_transfer">Physical Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : payment.payment_mode ? (
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Payment Mode</p>
                  <p className="text-gray-900">{getPaymentModeLabel(payment.payment_mode)}</p>
                </div>
              </div>
            ) : null}

            {/* Notes */}
            {isEditing ? (
              <div className="space-y-2">
                <Label className="text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notes
                </Label>
                <Input
                  placeholder="Additional notes..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            ) : notesWithoutPeriod ? (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-gray-900">{notesWithoutPeriod}</p>
                </div>
              </div>
            ) : null}

            {/* Proof Image - Read Only */}
            {payment.proof_url && (
              <>
                <Separator className="bg-gray-200" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                    <p className="text-sm text-gray-500">Payment Proof</p>
                  </div>
                  <div className="relative">
                    <img
                      src={payment.proof_url}
                      alt="Payment proof"
                      className="w-full rounded-lg border border-gray-200"
                    />
                    <a
                      href={payment.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white/90 rounded-md text-xs text-blue-600 hover:bg-white transition-colors shadow-sm"
                    >
                      Open Full Size
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Edit Mode Footer */}
          {isEditing && (
            <DialogFooter className="border-t border-gray-100 pt-4">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={saving}
                className="text-gray-600"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete Payment</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete this payment of Rs. {Number(payment.amount_paid).toFixed(2)}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 text-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
