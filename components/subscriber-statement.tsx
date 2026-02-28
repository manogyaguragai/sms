'use client';

import { useState, useEffect } from 'react';
import { getSubscriberPayments } from '@/app/actions/print-actions';
import { formatNepaliDate, formatNepaliDateTime, NEPALI_MONTHS } from '@/lib/nepali-date';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NepaliDatePicker } from '@/components/nepali-date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, Loader2, Calendar, Clock, User, Phone, Mail, CreditCard, Receipt } from 'lucide-react';
import type { Subscriber, Payment } from '@/lib/types';
import NepaliDate from 'nepali-date-converter';

interface SubscriberStatementProps {
  subscriber: Subscriber;
  open: boolean;
  onClose: () => void;
}

interface GroupedPayments {
  label: string;
  sortKey: string;
  payments: Payment[];
  subtotal: number;
}

function groupPaymentsByMonth(payments: Payment[]): GroupedPayments[] {
  const groups = new Map<string, { payments: Payment[]; label: string; sortKey: string }>();

  for (const payment of payments) {
    try {
      const date = new Date(payment.payment_date);
      const nepaliDate = new NepaliDate(date);
      const month = nepaliDate.getMonth();
      const year = nepaliDate.getYear();
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = `${NEPALI_MONTHS[month]} ${year}`;

      if (groups.has(key)) {
        groups.get(key)!.payments.push(payment);
      } else {
        groups.set(key, { payments: [payment], label, sortKey: key });
      }
    } catch {
      const key = 'unknown';
      if (groups.has(key)) {
        groups.get(key)!.payments.push(payment);
      } else {
        groups.set(key, { payments: [payment], label: 'Other', sortKey: 'zzz' });
      }
    }
  }

  return Array.from(groups.values())
    .map(g => ({
      ...g,
      subtotal: g.payments.reduce((sum, p) => sum + Number(p.amount_paid), 0),
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function SubscriberStatement({ subscriber, open, onClose }: SubscriberStatementProps) {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fetched, setFetched] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [attachReceipts, setAttachReceipts] = useState(false);
  const [isAllTime, setIsAllTime] = useState(true);
  const [printing, setPrinting] = useState(false);

  const fetchPayments = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const data = await getSubscriberPayments(subscriber.id, start, end);
      setPayments(data);
      setFetched(true);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !fetched) {
      fetchPayments();
    }
  }, [open]);

  const handleClose = () => {
    setFetched(false);
    setPayments([]);
    setStartDate(null);
    setEndDate(null);
    setIsAllTime(true);
    setAttachReceipts(false);
    onClose();
  };

  const handleAllTime = () => {
    setStartDate(null);
    setEndDate(null);
    setIsAllTime(true);
    fetchPayments();
  };

  // Convert JS Date to YYYY-MM-DD string using local date components
  // (avoids timezone shift from toISOString() which would move Nepal midnight to previous UTC day)
  const toLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleFilter = () => {
    if (!startDate || !endDate) return;
    setIsAllTime(false);
    fetchPayments(toLocalDateString(startDate), toLocalDateString(endDate));
  };

  // Auto-filter when both dates are selected
  useEffect(() => {
    if (startDate && endDate && fetched) {
      setIsAllTime(false);
      fetchPayments(toLocalDateString(startDate), toLocalDateString(endDate));
    }
  }, [startDate, endDate]);

  const grouped = groupPaymentsByMonth(payments);
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const printDateStr = formatNepaliDate(new Date(), 'full');

  // Build running balance
  let runningBalance = 0;
  const paymentBalances = new Map<string, number>();
  for (const payment of payments) {
    runningBalance += Number(payment.amount_paid);
    paymentBalances.set(payment.id, runningBalance);
  }

  const getPaymentModeLabel = (mode: string | null) => {
    switch (mode) {
      case 'online_transfer': return 'Online';
      case 'physical_transfer': return 'Physical';
      default: return '—';
    }
  };

  const extractPeriod = (notes: string | null): string => {
    if (!notes) return '';
    const match = notes.match(/Payment for:\s*([^|]+)/);
    return match?.[1]?.trim() || '';
  };

  const extractNotes = (notes: string | null): string => {
    if (!notes) return '';
    return notes.replace(/\|?\s*Payment for:\s*[^|]+/g, '').trim();
  };

  const statementPeriod = isAllTime
    ? 'All Time'
    : `${startDate ? formatNepaliDate(startDate, 'short') : '—'} to ${endDate ? formatNepaliDate(endDate, 'short') : '—'}`;

  const handlePrint = () => {
    setPrinting(true);

    // Build print HTML
    const groupsHtml = grouped.map(group => {
      const rowsHtml = group.payments.map(payment => {
        const period = extractPeriod(payment.notes);
        const notes = extractNotes(payment.notes);
        const periodTags = period
          ? period.split(',').map(p => `<span class="period-tag">${p.trim()}</span>`).join(' ')
          : '';
        const notesHtml = notes ? `<div class="notes-text">${notes}</div>` : '';
        const modeClass = payment.payment_mode === 'online_transfer' ? 'mode-online' : payment.payment_mode === 'physical_transfer' ? 'mode-physical' : '';
        const modeLabel = getPaymentModeLabel(payment.payment_mode);

        return `
          <tr>
            <td>${formatNepaliDateTime(payment.payment_date)}</td>
            <td class="mono">${payment.receipt_number || '—'}</td>
            <td>${payment.payment_mode ? `<span class="mode-badge ${modeClass}">${modeLabel}</span>` : '—'}</td>
            <td>${periodTags}${notesHtml}</td>
            <td class="text-right amount">Rs. ${Number(payment.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td class="text-right balance">Rs. ${(paymentBalances.get(payment.id) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');

      // Receipt images
      let receiptsHtml = '';
      if (attachReceipts) {
        const withProof = group.payments.filter(p => p.proof_url);
        if (withProof.length > 0) {
          const imgsHtml = withProof.map(p => `
            <div class="receipt-item">
              <div class="receipt-label">Receipt — ${p.receipt_number || formatNepaliDate(p.payment_date, 'short')} (Rs. ${Number(p.amount_paid).toFixed(2)})</div>
              <img src="${p.proof_url}" alt="Receipt" crossorigin="anonymous" />
            </div>
          `).join('');
          receiptsHtml = `<tr><td colspan="6" class="receipts-cell"><div class="receipts-grid">${imgsHtml}</div></td></tr>`;
        }
      }

      return `
        <div class="month-group">
          <div class="month-header">
            <span>${group.label}</span>
            <span>Subtotal: Rs. ${group.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <table>
            <thead><tr>
              <th style="width:20%">Date</th>
              <th style="width:12%">Receipt #</th>
              <th style="width:10%">Mode</th>
              <th>Period / Notes</th>
              <th class="text-right" style="width:14%">Amount</th>
              <th class="text-right" style="width:14%">Balance</th>
            </tr></thead>
            <tbody>${rowsHtml}${receiptsHtml}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Statement - ${subscriber.full_name}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1a1a2e;padding:28px 32px;background:#fff;font-size:11px;line-height:1.5}
      .stmt-header{border-bottom:3px solid #1a1a2e;padding-bottom:16px;margin-bottom:16px}
      .stmt-header h1{font-size:22px;font-weight:700;letter-spacing:.5px;margin-bottom:2px}
      .stmt-header .sub{font-size:12px;color:#555}
      .acct-info{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px;padding:12px 16px;background:#f8f9fa;border:1px solid #e5e7eb;border-radius:6px}
      .acct-info .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#888;font-weight:600}
      .acct-info .val{font-size:12px;font-weight:500;color:#1a1a2e}
      .period-info{display:inline-block;padding:3px 10px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:4px;font-size:10px;color:#4338ca;font-weight:600;margin-bottom:16px}
      .month-group{margin-bottom:14px;page-break-inside:avoid}
      .month-header{background:#1a1a2e;color:#fff;padding:6px 12px;font-size:11px;font-weight:600;border-radius:4px 4px 0 0;display:flex;justify-content:space-between}
      table{width:100%;border-collapse:collapse}
      thead th{background:#f1f5f9;padding:5px 10px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:1px solid #e2e8f0}
      tbody td{padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;vertical-align:top}
      .text-right{text-align:right}
      .amount{font-weight:600;font-variant-numeric:tabular-nums}
      .balance{color:#059669;font-weight:600}
      .mono{font-family:monospace;font-size:10px}
      .mode-badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600}
      .mode-online{background:#dbeafe;color:#1e40af}
      .mode-physical{background:#fef3c7;color:#92400e}
      .period-tag{display:inline-block;padding:1px 6px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:3px;font-size:9px;color:#4338ca;margin-right:2px}
      .notes-text{color:#666;font-size:10px;margin-top:2px}
      .receipts-cell{padding:8px 10px}
      .receipts-grid{display:flex;flex-wrap:wrap;gap:12px}
      .receipt-item{page-break-inside:avoid}
      .receipt-label{font-size:9px;color:#888;margin-bottom:4px}
      .receipt-item img{max-width:300px;max-height:250px;border:1px solid #e5e7eb;border-radius:4px;object-fit:contain}
      .summary{margin-top:20px;padding:14px 16px;border:2px solid #1a1a2e;border-radius:6px}
      .summary-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}
      .summary-row.total{border-top:1px solid #e5e7eb;margin-top:6px;padding-top:8px;font-size:14px;font-weight:700}
      .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#888}
      @media print{body{padding:16px}@page{margin:12mm;size:A4}.month-group{page-break-inside:avoid}.receipt-item{page-break-inside:avoid}}
    </style></head><body>
      <div class="stmt-header"><h1>Payment Statement</h1><p class="sub">SubTrack Management System</p></div>
      <div class="acct-info">
        <div><div class="lbl">Subscriber</div><div class="val">${subscriber.full_name}</div></div>
        <div><div class="lbl">Phone</div><div class="val">${subscriber.phone || '—'}</div></div>
        <div><div class="lbl">Email</div><div class="val">${subscriber.email || '—'}</div></div>
        <div><div class="lbl">Type</div><div class="val" style="text-transform:capitalize">${subscriber.frequency}</div></div>
        <div><div class="lbl">Member Since</div><div class="val">${formatNepaliDate(subscriber.created_at, 'short')}</div></div>
      </div>
      <div class="period-info">Statement Period: ${statementPeriod}</div>
      ${groupsHtml}
      ${payments.length > 0 ? `
        <div class="summary">
          <div class="summary-row"><span>Statement Period</span><span>${statementPeriod}</span></div>
          <div class="summary-row"><span>Total Transactions</span><span>${payments.length}</span></div>
          <div class="summary-row total"><span>Total Amount Paid</span><span>Rs. ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
        </div>
      ` : ''}
      <div class="footer"><span>Generated on ${printDateStr}</span><span>SubTrack Management System</span></div>
    </body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); setPrinting(false); }, 300);
    } else {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white border-gray-200 w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                Payment Statement
              </DialogTitle>
              <Button
                onClick={handlePrint}
                disabled={loading || payments.length === 0 || printing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                {printing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                Print
              </Button>
            </div>
          </DialogHeader>

          {/* Controls */}
          <div className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <Label className="text-gray-500 text-xs font-medium mb-1 block">From</Label>
                <NepaliDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Start date"
                  className="w-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-gray-500 text-xs font-medium mb-1 block">To</Label>
                <NepaliDatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="End date"
                  className="w-full"
                />
              </div>
              <Button
                onClick={handleAllTime}
                disabled={loading}
                variant={isAllTime ? 'default' : 'outline'}
                size="sm"
                className={isAllTime
                  ? 'bg-blue-600 hover:bg-blue-700 text-white h-9'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 h-9'
                }
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                All Time
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="attach-receipts"
                checked={attachReceipts}
                onCheckedChange={(checked: boolean) => setAttachReceipts(checked === true)}
              />
              <label
                htmlFor="attach-receipts"
                className="text-sm text-gray-600 cursor-pointer select-none"
              >
                Attach receipt image if present
              </label>
            </div>
          </div>
        </div>

        {/* Statement Content */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-500 text-sm">Loading statement...</span>
            </div>
          ) : (
            <div className="space-y-5 mt-4">
              {/* Subscriber Info Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Subscriber</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{subscriber.full_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Phone</p>
                  <p className="text-sm text-gray-700 mt-0.5">{subscriber.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Email</p>
                  <p className="text-sm text-gray-700 mt-0.5 truncate">{subscriber.email || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Type</p>
                  <p className="text-sm text-gray-700 mt-0.5 capitalize">{subscriber.frequency}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Member Since</p>
                  <p className="text-sm text-gray-700 mt-0.5">{formatNepaliDate(subscriber.created_at, 'short')}</p>
                </div>
              </div>

              {/* Period Badge */}
              <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 text-xs px-3 py-1">
                Statement Period: {statementPeriod}
              </Badge>

              {/* Month Groups */}
              {grouped.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No payment records found for this period.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {grouped.map((group) => (
                    <div key={group.sortKey} className="rounded-lg border border-gray-200 overflow-hidden">
                      {/* Month Header */}
                      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm">
                        <span className="font-semibold">{group.label}</span>
                        <span className="text-gray-300 text-xs">
                          Subtotal: Rs. {group.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Payment Rows */}
                      <div className="divide-y divide-gray-100">
                        {group.payments.map((payment) => {
                          const period = extractPeriod(payment.notes);
                          const notes = extractNotes(payment.notes);
                          return (
                            <div key={payment.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                {/* Left: Date + Receipt + Mode */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm text-gray-900 font-medium">
                                      {formatNepaliDateTime(payment.payment_date)}
                                    </span>
                                    {payment.receipt_number && (
                                      <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500 bg-white font-mono px-1.5 py-0">
                                        #{payment.receipt_number}
                                      </Badge>
                                    )}
                                    {payment.payment_mode && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 ${
                                          payment.payment_mode === 'online_transfer'
                                            ? 'border-blue-200 text-blue-700 bg-blue-50'
                                            : 'border-amber-200 text-amber-700 bg-amber-50'
                                        }`}
                                      >
                                        {getPaymentModeLabel(payment.payment_mode)}
                                      </Badge>
                                    )}
                                  </div>
                                  {period && (
                                    <div className="flex flex-wrap gap-1">
                                      {period.split(',').map((p, i) => (
                                        <Badge
                                          key={i}
                                          variant="outline"
                                          className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50 px-1.5 py-0"
                                        >
                                          {p.trim()}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {notes && (
                                    <p className="text-xs text-gray-400">{notes}</p>
                                  )}
                                </div>

                                {/* Right: Amount + Balance */}
                                <div className="flex items-center gap-4 sm:text-right shrink-0">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900 tabular-nums">
                                      Rs. {Number(payment.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div className="hidden sm:block">
                                    <p className="text-xs text-gray-400">Balance</p>
                                    <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                                      Rs. {(paymentBalances.get(payment.id) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Receipt Images */}
                        {attachReceipts && group.payments.some(p => p.proof_url) && (
                          <div className="px-4 py-3 bg-gray-50">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Receipt Images</p>
                            <div className="flex flex-wrap gap-3">
                              {group.payments.filter(p => p.proof_url).map(payment => (
                                <div key={`img-${payment.id}`} className="space-y-1">
                                  <p className="text-[10px] text-gray-400">
                                    {payment.receipt_number || formatNepaliDate(payment.payment_date, 'short')} — Rs. {Number(payment.amount_paid).toFixed(2)}
                                  </p>
                                  <img
                                    src={payment.proof_url!}
                                    alt="Receipt"
                                    className="max-w-[250px] max-h-[200px] rounded border border-gray-200 object-contain"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {payments.length > 0 && (
                <div className="rounded-lg border-2 border-gray-900 p-4 space-y-1">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Statement Period</span>
                    <span>{statementPeriod}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Total Transactions</span>
                    <span>{payments.length}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total Amount Paid</span>
                    <span>Rs. {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-between text-xs text-gray-400 pt-2">
                <span>Generated on {printDateStr}</span>
                <span>SubTrack Management System</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
