'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Calendar, 
  Receipt, 
  CreditCard, 
  FileText, 
  Image as ImageIcon,
  ExternalLink 
} from 'lucide-react';
import type { Payment } from '@/lib/types';
import { formatNepaliDateTime, formatNepaliDate } from '@/lib/nepali-date';

interface PaymentDetailModalProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
}

export function PaymentDetailModal({ payment, open, onClose }: PaymentDetailModalProps) {
  if (!payment) return null;

  // Extract payment period from notes
  const periodMatch = payment.notes?.match(/Payment for:\s*([^|]+)/);
  const paymentPeriod = periodMatch?.[1]?.trim();

  // Get notes without the period info
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border-gray-200 w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Payment Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
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

          <Separator className="bg-gray-200" />

          {/* Payment Period */}
          {paymentPeriod && (
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
          )}

          {/* Payment Date */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">Payment Date</p>
              <p className="text-gray-900">{formatNepaliDateTime(payment.payment_date)}</p>
            </div>
          </div>

          {/* Receipt Number */}
          {payment.receipt_number && (
            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Receipt Number</p>
                <p className="text-gray-900 font-mono">{payment.receipt_number}</p>
              </div>
            </div>
          )}

          {/* Payment Mode */}
          {payment.payment_mode && (
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Payment Mode</p>
                <p className="text-gray-900">{getPaymentModeLabel(payment.payment_mode)}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {notesWithoutPeriod && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-gray-900">{notesWithoutPeriod}</p>
              </div>
            </div>
          )}

          {/* Proof Image */}
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
      </DialogContent>
    </Dialog>
  );
}
