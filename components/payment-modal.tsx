'use client';

import { useState, useMemo } from 'react';
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
import { Loader2, Upload, FileText, Image as ImageIcon, Calendar, ChevronLeft, ChevronRight, Check, Receipt, CreditCard, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';
import imageCompression from 'browser-image-compression';
import NepaliDate from 'nepali-date-converter';
import { NepaliDateTimePicker } from '@/components/nepali-datetime-picker';
import type { Subscriber } from '@/lib/types';
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

  // Month/Year picker state (using Nepali year - Bikram Sambat)
  const currentDate = new Date();
  const currentNepaliYear = currentDate.getFullYear() + 57; // Convert to BS
  const [pickerYear, setPickerYear] = useState(currentNepaliYear);
  const [selectedMonths, setSelectedMonths] = useState<MonthSelection[]>([
    { month: currentDate.getMonth(), year: currentNepaliYear }
  ]);

  // Calculate amount based on selected months
  const amount = useMemo(() => {
    if (subscriber.frequency === 'annual') {
      return subscriber.monthly_rate; // Annual rate for annual subscribers
    }
    return subscriber.monthly_rate * selectedMonths.length;
  }, [selectedMonths.length, subscriber.monthly_rate, subscriber.frequency]);

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
      // Don't remove if it's the only selection
      if (selectedMonths.length === 1) return;
      setSelectedMonths(selectedMonths.filter(
        m => !(m.month === monthIndex && m.year === pickerYear)
      ));
    } else {
      setSelectedMonths([...selectedMonths, selection]);
    }
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
    // Convert Nepali year back to Gregorian for database storage
    const gregorianYear = toGregorianYear(sorted[0].year);
    return startOfMonth(new Date(gregorianYear, sorted[0].month, 1));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let proofUrl = null;

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
          // Show warning but continue with payment recording
          toast.warning('Image upload failed. Payment will be recorded without proof.');
        } else {
          const { data: urlData } = supabase.storage
            .from('vouchers')
            .getPublicUrl(fileName);

          proofUrl = urlData.publicUrl;
        }
      }

      // Get the payment period
      const paymentForPeriod = getPaymentForPeriod();
      const periodLabel = getSelectedPeriodsLabel();

      // Create payment record with payment_for_period
      const { data: paymentData, error: paymentError } = await supabase.from('payments').insert({
        subscriber_id: subscriber.id,
        amount_paid: amount,
        notes: notes ? `${notes} | Payment for: ${periodLabel}` : `Payment for: ${periodLabel}`,
        proof_url: proofUrl,
        payment_for_period: paymentForPeriod?.toISOString() || null,
        receipt_number: receiptNumber || null,
        payment_mode: paymentMode || null,
        payment_date: new Date(paymentDate).toISOString(),
      }).select('id').single();

      if (paymentError) throw paymentError;

      // Log the payment creation
      if (paymentData) {
        await logPaymentCreation(paymentData.id, subscriber.full_name, amount);
      }

      // Update subscriber's subscription_end_date
      // Add duration based on number of months selected (for monthly) or 365 days (for annual)
      const currentEndDate = new Date(subscriber.subscription_end_date);
      let newEndDate: Date;

      // Sort selected months to find the last one chronologically
      const sorted = [...selectedMonths].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      const lastPeriod = sorted[sorted.length - 1];

      if (subscriber.frequency === 'monthly') {
        // End date is the first day of the month AFTER the last selected month (in Nepali calendar)
        // This means the subscription is valid through the entire last selected month
        let endMonth = lastPeriod.month + 1; // Next month (0-indexed, so +1 gives us the next)
        let endYear = lastPeriod.year;

        // Handle year rollover (Chaitra is month 11, so month 12 means next year's Baisakh)
        if (endMonth > 11) {
          endMonth = 0; // Baisakh
          endYear = endYear + 1;
        }

        // Create a Nepali date for the first day of the next month and convert to JS Date
        const nepaliEndDate = new NepaliDate(endYear, endMonth, 1);
        newEndDate = nepaliEndDate.toJsDate();
      } else {
        // Annual: subscription valid for 1 year from the start of the selected period
        // End date is the first day of the same month next year
        const nepaliEndDate = new NepaliDate(lastPeriod.year + 1, lastPeriod.month, 1);
        newEndDate = nepaliEndDate.toJsDate();
      }

      const { error: updateError } = await supabase
        .from('subscribers')
        .update({
          subscription_end_date: newEndDate.toISOString(),
          status: 'active',
          status_notes: null, // Clear any previous inactive notes
        })
        .eq('id', subscriber.id);

      if (updateError) throw updateError;

      toast.success(`Payment recorded for ${periodLabel}!`);
      onClose();
      router.refresh();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNotes('');
      setFile(null);
      setPreview(null);
      // Reset to current Nepali date
      const now = new Date();
      const currentBsYear = toNepaliYear(now.getFullYear());
      setSelectedMonths([{ month: now.getMonth(), year: currentBsYear }]);
      setPickerYear(currentBsYear);
      setReceiptNumber('');
      setPaymentMode('');
      setPaymentDate(now);
      onClose();
    }
  };

  return (
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

              {/* Month grid */}
              <div className="grid grid-cols-4 gap-2">
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
                {getSelectedPeriodsLabel()}
                {subscriber.frequency === 'monthly' && selectedMonths.length > 1 && (
                  <span className="text-blue-600 ml-2">({selectedMonths.length} months)</span>
                )}
              </div>
            </div>
          </div>

          {/* Amount - Auto-calculated */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-gray-700">
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 font-medium">NRs.</span>
              <Input
                id="amount"
                type="text"
                value={amount.toFixed(2)}
                disabled
                className="pl-14 bg-gray-100 border-gray-300 text-gray-900"
              />
            </div>
            {subscriber.frequency === 'monthly' && selectedMonths.length > 1 && (
              <p className="text-xs text-gray-500">
                {subscriber.monthly_rate} × {selectedMonths.length} months = Rs. {amount.toFixed(2)}
              </p>
            )}
          </div>

          {/* Receipt Number */}
          <div className="space-y-2">
            <Label htmlFor="receiptNumber" className="text-gray-700 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Receipt Number (optional)
            </Label>
            <Input
              id="receiptNumber"
              placeholder="e.g., REC-001234"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
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
            <Label className="text-gray-700">Payment Proof (optional)</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                preview
                  ? 'border-green-500/50 bg-green-50'
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
                    onChange={handleFileChange}
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
  );
}

