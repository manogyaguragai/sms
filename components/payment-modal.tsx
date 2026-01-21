'use client';

import { useState } from 'react';
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
import { Loader2, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { addMonths, addDays } from 'date-fns';
import imageCompression from 'browser-image-compression';
import type { Subscriber } from '@/lib/types';

interface PaymentModalProps {
  subscriber: Subscriber;
  open: boolean;
  onClose: () => void;
}

export function PaymentModal({ subscriber, open, onClose }: PaymentModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(
    subscriber.frequency === 'monthly'
      ? subscriber.monthly_rate
      : subscriber.monthly_rate
  );
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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

      // Create payment record
      const { error: paymentError } = await supabase.from('payments').insert({
        subscriber_id: subscriber.id,
        amount_paid: amount,
        notes: notes || null,
        proof_url: proofUrl,
      });

      if (paymentError) throw paymentError;

      // Update subscriber's subscription_end_date
      // Add duration based on frequency (use 365 days for annual as per spec)
      const currentEndDate = new Date(subscriber.subscription_end_date);
      const newEndDate =
        subscriber.frequency === 'monthly'
          ? addMonths(currentEndDate, 1)
          : addDays(currentEndDate, 365);

      const { error: updateError } = await supabase
        .from('subscribers')
        .update({
          subscription_end_date: newEndDate.toISOString(),
          status: 'active',
        })
        .eq('id', subscriber.id);

      if (updateError) throw updateError;

      toast.success('Payment recorded successfully!');
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
      setAmount(subscriber.monthly_rate);
      setNotes('');
      setFile(null);
      setPreview(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white border-gray-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Record Payment</DialogTitle>
          <DialogDescription className="text-gray-600">
            Record a payment for {subscriber.full_name}. The subscription will be extended by{' '}
            {subscriber.frequency === 'monthly' ? '1 month' : '365 days'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-gray-700">
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 font-medium">NRs.</span>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setAmount(parseFloat(value) || 0);
                  }
                }}
                required
                className="pl-14 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-700">
              Notes (optional)
            </Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="notes"
                placeholder="Payment via bank transfer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
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

          <DialogFooter className="pt-4">
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
