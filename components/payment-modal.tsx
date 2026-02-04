'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Upload, FileText, Image as ImageIcon, Calendar, ChevronLeft, ChevronRight, Check, Receipt, CreditCard, HelpCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';
import imageCompression from 'browser-image-compression';
import NepaliDate from 'nepali-date-converter';
import { NepaliDateTimePicker } from '@/components/nepali-datetime-picker';
import type { Subscriber, Payment } from '@/lib/types';
import { logPaymentCreation } from '@/app/actions/subscriber';

interface PaymentModalProps {
  subscriber: Subscriber;
  open: boolean;
  onClose: () => void;
}

interface MonthSelection {
  month: number;
  year: number;
}

export function PaymentModal({ subscriber, open, onClose }: PaymentModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState<'online_transfer' | 'physical_transfer' | ''>('');
  const [paymentDate, setPaymentDate] = useState<Date>(() => new Date());
  const [amount, setAmount] = useState<string>(''); // Manual amount entry
  const [proofError, setProofError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // Conflict resolution state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictingPayments, setConflictingPayments] = useState<Payment[]>([]);
  const [pendingProofUrl, setPendingProofUrl] = useState<string | null>(null);

  // Month/Year picker state (using Nepali year - Bikram Sambat)
  // Current Nepali date: 2082 Magh 21
  const [pickerYear, setPickerYear] = useState(2082);
  const [selectedMonths, setSelectedMonths] = useState<MonthSelection[]>([]);

  // Reset all form state when modal opens to ensure fresh start
  useEffect(() => {
    if (open) {
      setNotes('');
      setFile(null);
      setPreview(null);
      setReceiptNumber('');
      setPaymentMode('');
      setPaymentDate(new Date());
      setAmount('');
      setProofError(null);
      setPeriodError(null);
      setSelectedMonths([]);
      setPickerYear(2082);
      setShowConflictDialog(false);
      setConflictingPayments([]);
      setPendingProofUrl(null);
    }
  }, [open]);

  // Nepali month names
  const months = [
    'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
  ];

  // Convert Gregorian year to Nepali Bikram Sambat (BS) year
  // BS year is approximately 56-57 years ahead of AD
  const toNepaliYear = (gregorianYear: number) => gregorianYear + 57;
  const toGregorianYear = (nepaliYear: number) => nepaliYear - 57;

  const toggleMonth = (monthIndex: number) => {
    const selection = { month: monthIndex, year: pickerYear };
    const exists = selectedMonths.some(
      m => m.month === monthIndex && m.year === pickerYear
    );

    if (exists) {
      // Allow removing even last selection now
      setSelectedMonths(selectedMonths.filter(
        m => !(m.month === monthIndex && m.year === pickerYear)
      ));
    } else {
      setSelectedMonths([...selectedMonths, selection]);
    }
    setPeriodError(null); // Clear error when user interacts
  };

  const isMonthSelected = (monthIndex: number) => {
    return selectedMonths.some(
      m => m.month === monthIndex && m.year === pickerYear
    );
  };

  // Get the earliest selected period for storage
  const getPaymentForPeriod = () => {
    const sorted = [...selectedMonths].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    if (sorted.length === 0) return null;
    // Create a NepaliDate for the first day of the earliest selected month
    // and convert to JS Date for storage (proper Nepali-to-Gregorian conversion)
    const nepaliDate = new NepaliDate(sorted[0].year, sorted[0].month, 1);
    return nepaliDate.toJsDate();
  };

  const getSelectedPeriodsLabel = () => {
    const sorted = [...selectedMonths].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    return sorted.map(m => `${months[m.month]} ${m.year}`).join(', ');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      // Compress the image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/webp' as const,
      };

      toast.info('Compressing image...');
      const compressedFile = await imageCompression(selectedFile, options);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);

      setFile(compressedFile);
      toast.success('Image compressed successfully');
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Failed to compress image');
    }
  };

  // Parse period from notes field (e.g., "Payment for: Baisakh 2083" or "For: Baisakh 2083")
  const parsePeriodFromNotes = (notesStr: string): MonthSelection | null => {
    try {
      console.log('Trying to parse notes:', notesStr);
      // Match pattern like "Payment for: Baisakh 2083" or "For: Baisakh 2083"
      // Use a flexible pattern that handles various separators and formats
      const match = notesStr.match(/(?:Payment\s+)?[Ff]or[:\s]+([A-Za-z]+)\s+(\d{4})/);
      console.log('Regex match result:', match);
      if (!match) return null;

      const monthName = match[1];
      const year = parseInt(match[2], 10);

      // Find month index
      const monthIndex = months.findIndex(
        m => m.toLowerCase() === monthName.toLowerCase()
      );
      console.log('Month name:', monthName, 'Year:', year, 'Month index:', monthIndex);

      if (monthIndex === -1 || isNaN(year)) return null;

      return { month: monthIndex, year };
    } catch (e) {
      console.log('Error parsing notes:', e);
      return null;
    }
  };

  // Helper to get Nepali month/year from a payment record
  // IMPORTANT: We try notes first because old payments have corrupt dates but correct notes
  const getMonthYearFromPayment = (payment: Payment): MonthSelection | null => {
    // Try parsing from notes first (more reliable for old data)
    if (payment.notes) {
      const fromNotes = parsePeriodFromNotes(payment.notes);
      if (fromNotes) {
        console.log('Parsed from notes:', fromNotes, 'from:', payment.notes);
        return fromNotes;
      }
    }

    // Fallback: try date conversion (for future properly stored data)
    if (payment.payment_for_period) {
      try {
        const date = new Date(payment.payment_for_period);
        const nepaliDate = new NepaliDate(date);
        const result = { month: nepaliDate.getMonth(), year: nepaliDate.getYear() };
        console.log('Parsed from payment_for_period:', result, 'from date:', payment.payment_for_period);
        return result;
      } catch (e) {
        console.log('Failed to parse payment_for_period:', e);
      }
    }

    return null;
  };

  // Legacy helper for backwards compatibility (keeping for end date calculation)
  const getMonthYearFromPeriod = (periodDate: string): MonthSelection | null => {
    try {
      const date = new Date(periodDate);
      const nepaliDate = new NepaliDate(date);
      return { month: nepaliDate.getMonth(), year: nepaliDate.getYear() };
    } catch {
      return null;
    }
  };

  // Check for duplicate payments for the same periods
  const checkForConflicts = async (): Promise<Payment[]> => {
    // Fetch ALL payments for this subscriber (not just those with payment_for_period)
    // because old data might have corrupt period but notes still has the correct info
    const { data: existingPayments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('subscriber_id', subscriber.id);

    if (error || !existingPayments) {
      console.log('Failed to fetch payments for conflict check:', error);
      return [];
    }

    console.log('Checking conflicts - existing payments:', existingPayments.length);
    console.log('Selected months:', selectedMonths);

    // Find payments that overlap with any selected month
    const conflicting = existingPayments.filter((payment: Payment) => {
      // Use the new function that tries date parsing first, then notes parsing
      const paymentPeriod = getMonthYearFromPayment(payment);
      if (!paymentPeriod) {
        console.log('Could not parse period for payment:', payment.id);
        return false;
      }
      console.log('Payment period:', paymentPeriod, 'for payment:', payment.id);

      const matches = selectedMonths.some(
        m => m.month === paymentPeriod.month && m.year === paymentPeriod.year
      );
      if (matches) console.log('Found conflict with payment:', payment.id);
      return matches;
    });

    console.log('Conflicting payments found:', conflicting.length);
    return conflicting;
  };

  // Calculate end date from a list of unique periods (handles both old and new)
  const calculateEndDateFromPeriods = (periods: MonthSelection[]): Date => {
    // Deduplicate periods by month+year
    const uniqueKey = (m: MonthSelection) => `${m.year}-${m.month}`;
    const seen = new Set<string>();
    const uniquePeriods = periods.filter(m => {
      const key = uniqueKey(m);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort to find the last period chronologically
    const sorted = uniquePeriods.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    const lastPeriod = sorted[sorted.length - 1];

    if (subscriber.frequency === 'monthly') {
      let endMonth = lastPeriod.month + 1;
      let endYear = lastPeriod.year;
      if (endMonth > 11) {
        endMonth = 0;
        endYear = endYear + 1;
      }
      const nepaliEndDate = new NepaliDate(endYear, endMonth, 1);
      return nepaliEndDate.toJsDate();
    } else {
      const nepaliEndDate = new NepaliDate(lastPeriod.year + 1, lastPeriod.month, 1);
      return nepaliEndDate.toJsDate();
    }
  };

  // Insert payment and update subscription end date
  const insertPaymentAndUpdateSubscription = async (
    proofUrl: string | null,
    additionalPeriods: MonthSelection[] = []
  ) => {
    const amountValue = parseFloat(amount);
    const paymentForPeriod = getPaymentForPeriod();
    const periodLabel = getSelectedPeriodsLabel();

    // Create payment record
    const { data: paymentData, error: paymentError } = await supabase.from('payments').insert({
      subscriber_id: subscriber.id,
      amount_paid: amountValue,
      notes: notes ? `${notes} | Payment for: ${periodLabel}` : `Payment for: ${periodLabel}`,
      proof_url: proofUrl,
      payment_for_period: paymentForPeriod?.toISOString() || null,
      receipt_number: receiptNumber || null,
      payment_mode: paymentMode || null,
      payment_date: new Date(paymentDate).toISOString(),
    }).select('id').single();

    if (paymentError) throw paymentError;

    if (paymentData) {
      await logPaymentCreation(paymentData.id, subscriber.full_name, amountValue);
    }

    // Calculate end date from all unique periods (new + any additional from existing payments)
    const allPeriods = [...selectedMonths, ...additionalPeriods];
    const newEndDate = calculateEndDateFromPeriods(allPeriods);

    const { error: updateError } = await supabase
      .from('subscribers')
      .update({
        subscription_end_date: newEndDate.toISOString(),
        status: 'active',
        status_notes: null,
      })
      .eq('id', subscriber.id);

    if (updateError) throw updateError;

    toast.success(`Payment recorded for ${periodLabel}!`);
    onClose();
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: Check if at least one month is selected
    if (selectedMonths.length === 0) {
      setPeriodError('Please select at least one payment period');
      return;
    }

    // Validation: Check if either image or receipt number is provided
    if (!file && !receiptNumber.trim()) {
      setProofError('Please provide either a payment proof image or a receipt number');
      return;
    }

    // Validation: Check if amount is valid
    const amountValue = parseFloat(amount);
    if (!amount || isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      let proofUrl: string | null = null;

      // Upload proof if provided
      if (file) {
        const fileName = `${subscriber.id}/${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from('vouchers')
          .upload(fileName, file, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          toast.warning('Image upload failed. Payment will be recorded without proof.');
        } else {
          const { data: urlData } = supabase.storage
            .from('vouchers')
            .getPublicUrl(fileName);
          proofUrl = urlData.publicUrl;
        }
      }

      // Check for conflicting payments
      const conflicts = await checkForConflicts();

      if (conflicts.length > 0) {
        // Store proof URL for later use and show conflict dialog
        setPendingProofUrl(proofUrl);
        setConflictingPayments(conflicts);
        setShowConflictDialog(true);
        setLoading(false);
        return;
      }

      // No conflicts, proceed with normal insert
      await insertPaymentAndUpdateSubscription(proofUrl);
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for "Keep Old" - user wants to cancel the new payment
  const handleKeepOld = () => {
    setShowConflictDialog(false);
    setConflictingPayments([]);
    setPendingProofUrl(null);
    toast.info('New payment cancelled. Existing payment retained.');
  };

  // Handler for "Keep New" - delete old payments and insert new
  const handleKeepNew = async () => {
    setLoading(true);
    try {
      // Delete conflicting payments
      for (const payment of conflictingPayments) {
        await supabase.from('payments').delete().eq('id', payment.id);
      }

      // Insert new payment
      await insertPaymentAndUpdateSubscription(pendingProofUrl);
    } catch (error) {
      console.error('Error replacing payment:', error);
      toast.error('Failed to replace payment. Please try again.');
    } finally {
      setLoading(false);
      setShowConflictDialog(false);
      setConflictingPayments([]);
      setPendingProofUrl(null);
    }
  };

  // Handler for "Keep Both" - insert new payment alongside old, but don't double-count end date
  const handleKeepBoth = async () => {
    setLoading(true);
    try {
      // Collect periods from existing payments to avoid double-counting
      const existingPeriods: MonthSelection[] = [];
      for (const payment of conflictingPayments) {
        const period = getMonthYearFromPayment(payment);
        if (period) existingPeriods.push(period);
      }

      // Insert new payment, but calculate end date considering all unique periods
      await insertPaymentAndUpdateSubscription(pendingProofUrl, existingPeriods);
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Failed to add payment. Please try again.');
    } finally {
      setLoading(false);
      setShowConflictDialog(false);
      setConflictingPayments([]);
      setPendingProofUrl(null);
    }
  };

  // Get conflict details for display
  const getConflictDetails = () => {
    return conflictingPayments.map(payment => {
      const period = getMonthYearFromPayment(payment);
      const periodLabel = period ? `${months[period.month]} ${period.year}` : 'Unknown';
      return {
        id: payment.id,
        amount: payment.amount_paid,
        date: payment.payment_date,
        period: periodLabel,
      };
    });
  };

  const handleClose = () => {
    if (!loading) {
      setNotes('');
      setFile(null);
      setPreview(null);
      setSelectedMonths([]);
      setPickerYear(2082);
      setReceiptNumber('');
      setPaymentMode('');
      setPaymentDate(new Date());
      setAmount('');
      setProofError(null);
      setPeriodError(null);
      setShowConflictDialog(false);
      setConflictingPayments([]);
      setPendingProofUrl(null);
      onClose();
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white border-gray-200 w-[95vw] max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-900">Record Payment</DialogTitle>
          <DialogDescription className="text-gray-600">
            Record a payment for {subscriber.full_name}. Select the period(s) this payment covers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Payment Period Selector */}
          <div className="space-y-2">
            <Label className="text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Payment Period(s)
            </Label>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              {/* Year selector */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerYear(pickerYear - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-semibold text-gray-900">{pickerYear}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerYear(pickerYear + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Month grid - 3 cols on mobile, 4 on tablet+ */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {months.map((month, index) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => toggleMonth(index)}
                    className={`px-2 py-2 text-sm rounded-md transition-colors relative ${isMonthSelected(index)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                  >
                    {month}
                    {isMonthSelected(index) && (
                      <Check className="w-3 h-3 absolute top-0.5 right-0.5" />
                    )}
                  </button>
                ))}
              </div>

              {/* Selected periods summary */}
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Selected: </span>
                  {selectedMonths.length === 0
                    ? <span className="text-gray-400">None selected</span>
                    : getSelectedPeriodsLabel()
                  }
                {subscriber.frequency === 'monthly' && selectedMonths.length > 1 && (
                  <span className="text-blue-600 ml-2">({selectedMonths.length} months)</span>
                )}
              </div>
                {periodError && (
                  <p className="mt-2 text-sm text-red-600">{periodError}</p>
                )}
            </div>
          </div>

            {/* Amount - Manual Entry */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-gray-700">
                Amount *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 font-medium">NRs.</span>
              <Input
                id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="pl-14 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              </div>
          </div>

          {/* Receipt Number */}
          <div className="space-y-2">
            <Label htmlFor="receiptNumber" className="text-gray-700 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
                Receipt Number
            </Label>
            <Input
              id="receiptNumber"
              placeholder="e.g., REC-001234"
              value={receiptNumber}
                onChange={(e) => {
                  setReceiptNumber(e.target.value);
                  setProofError(null);
                }}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Mode of Payment */}
          <div className="space-y-2">
            <Label className="text-gray-700 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Mode of Payment
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium">Online Transfer:</p>
                    <p className="text-sm">Bank, eSewa, Khalti, FonePay, etc.</p>
                    <p className="font-medium mt-2">Physical Transfer:</p>
                    <p className="text-sm">Cash, Card, or Cheque</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select value={paymentMode} onValueChange={(value: 'online_transfer' | 'physical_transfer') => setPaymentMode(value)}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online_transfer">Online Transfer</SelectItem>
                <SelectItem value="physical_transfer">Physical Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Date - Nepali Calendar */}
          <div className="space-y-2">
            <Label className="text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Payment Date (Nepali Calendar)
            </Label>
            <NepaliDateTimePicker
              value={paymentDate}
              onChange={setPaymentDate}
              className="w-full"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes (optional)
            </Label>
            <Input
              id="notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Proof Upload */}
          <div className="space-y-2">
              <Label className="text-gray-700">Payment Proof Image</Label>
              <p className="text-xs text-amber-600">* Either receipt number or proof image is required</p>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                preview
                  ? 'border-green-500/50 bg-green-50'
                  : proofError
                    ? 'border-red-300 hover:border-red-400 bg-red-50'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
            >
              {preview ? (
                <div className="space-y-2">
                  <img
                    src={preview}
                    alt="Payment proof preview"
                    className="max-h-32 mx-auto rounded-lg"
                  />
                  <p className="text-sm text-green-600">Image ready for upload</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="text-gray-500 hover:text-red-500"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="image/*"
                        onChange={(e) => {
                          handleFileChange(e);
                          setProofError(null);
                        }}
                    className="hidden"
                  />
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600">
                      Click to upload payment voucher
                    </p>
                    <p className="text-xs text-gray-400">
                      Images will be compressed to max 1200px
                    </p>
                  </div>
                </label>
              )}
            </div>
              {proofError && (
                <p className="text-sm text-red-600">{proofError}</p>
              )}
          </div>

          <DialogFooter className="pt-4 flex-shrink-0 border-t border-gray-100 bg-white -mx-2 px-2 mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

      {/* Conflict Resolution Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent className="bg-white max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <AlertDialogTitle>Duplicate Payment Detected</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild className="text-gray-600 space-y-3 pt-2">
              <div>
                <span className="block">
                  A payment record already exists for the selected period(s).
                  Please choose how you want to proceed:
                </span>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <span className="font-medium text-amber-800 text-sm block">Existing Payment(s):</span>
                  {getConflictDetails().map((conflict, idx) => (
                    <div key={idx} className="text-sm text-amber-700">
                      <span className="font-medium">{conflict.period}</span>
                      {' - '}
                      NRs. {conflict.amount.toLocaleString()}
                      {' '}
                      <span className="text-amber-600">
                        ({format(new Date(conflict.date), 'MMM d, yyyy')})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleKeepOld}
              variant="outline"
              className="w-full border-gray-300"
              disabled={loading}
            >
              Keep Existing (Cancel New)
            </Button>
            <Button
              onClick={handleKeepNew}
              variant="outline"
              className="w-full border-red-300 text-red-600 hover:bg-red-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Replace with New'
              )}
            </Button>
            <Button
              onClick={handleKeepBoth}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Keep Both Records'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

