'use client';

import { useState, useRef } from 'react';
import { getAllSubscribersForPrint, type SubscriberPrintData } from '@/app/actions/print-actions';
import { formatNepaliDate } from '@/lib/nepali-date';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';

interface PrintSubscriberListProps {
  open: boolean;
  onClose: () => void;
}

export function PrintSubscriberList({ open, onClose }: PrintSubscriberListProps) {
  const [loading, setLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<SubscriberPrintData[]>([]);
  const [fetched, setFetched] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getAllSubscribersForPrint();
      setSubscribers(data);
      setFetched(true);
    } catch (error) {
      console.error('Error fetching print data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when dialog opens
  if (open && !fetched && !loading) {
    fetchData();
  }

  // Reset when dialog closes
  const handleClose = () => {
    setFetched(false);
    setSubscribers([]);
    onClose();
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const today = new NepaliDate(new Date());
    const todayStr = `${today.getYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Subscriber List - ${todayStr}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: #1a1a2e;
            padding: 28px 32px;
            background: #fff;
            font-size: 11px;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 2px solid #1a1a2e;
          }
          .header h1 {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .header p {
            font-size: 11px;
            color: #555;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }
          thead th {
            background: #1a1a2e;
            color: #fff;
            padding: 7px 10px;
            text-align: left;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          thead th:first-child {
            border-radius: 4px 0 0 0;
          }
          thead th:last-child {
            border-radius: 0 4px 0 0;
            text-align: right;
          }
          tbody td {
            padding: 6px 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
          }
          tbody tr:nth-child(even) {
            background: #f8f9fa;
          }
          tbody tr:hover {
            background: #eef2ff;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
          }
          .badge-monthly { background: #dbeafe; color: #1e40af; }
          .badge-annual { background: #dcfce7; color: #166534; }
          .badge-12_hajar { background: #f3e8ff; color: #6b21a8; }
          .badge-active {
            background: #dcfce7;
            color: #166534;
          }
          .badge-inactive, .badge-expired, .badge-cancelled {
            background: #fee2e2;
            color: #991b1b;
          }
          .sn { width: 35px; text-align: center; color: #888; }
          .footer {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 2px solid #1a1a2e;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #555;
          }
          .footer strong {
            color: #1a1a2e;
          }
          .total-row td {
            font-weight: 700;
            border-top: 2px solid #1a1a2e;
            background: #f0f4ff !important;
            padding: 8px 10px;
          }
          @media print {
            body { padding: 16px; }
            @page { margin: 12mm; size: A4 landscape; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const grandTotal = subscribers.reduce((sum, s) => sum + s.total_paid, 0);
  const activeCount = subscribers.filter(s => s.status === 'active').length;

  const today = new NepaliDate(new Date());
  const printDateStr = formatNepaliDate(new Date(), 'full');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white border-gray-200 max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              Print Subscriber List
            </DialogTitle>
            <Button
              onClick={handlePrint}
              disabled={loading || subscribers.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-500">Loading subscriber data...</span>
          </div>
        ) : (
          <div ref={printRef}>
            <div className="header">
              <h1>Subscriber List</h1>
              <p>Generated on {printDateStr} &bull; Total: {subscribers.length} subscribers ({activeCount} active)</p>
            </div>

            <table>
              <thead>
                <tr>
                  <th className="sn">S.N.</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Rate</th>
                  <th>Payments</th>
                  <th>Total Paid</th>
                  <th>Last Payment</th>
                    <th>Sub. End Date</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub, index) => (
                  <tr key={sub.id}>
                    <td className="sn">{index + 1}</td>
                    <td style={{ fontWeight: 500 }}>{sub.full_name}</td>
                    <td>{sub.phone || '—'}</td>
                    <td>
                      <span className={`badge badge-${sub.status}`}>
                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      {(Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency]).map((f: string) => (
                        <span key={f} className={`badge badge-${f}`} style={{ marginRight: '2px' }}>
                          {f === '12_hajar' ? '12 Hajar' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </span>
                      ))}
                    </td>
                    <td>Rs. {Number(sub.monthly_rate).toLocaleString()}</td>
                    <td className="text-center">{sub.payment_count}</td>
                    <td className="text-right" style={{ fontWeight: 500 }}>
                      Rs. {sub.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      {sub.last_payment_date
                        ? formatNepaliDate(sub.last_payment_date, 'short')
                        : '—'}
                    </td>
                    <td>
                      {sub.subscription_end_date
                        ? formatNepaliDate(sub.subscription_end_date, 'short')
                        : '—'}
                    </td>
                  </tr>
                ))}
                {subscribers.length > 0 && (
                  <tr className="total-row">
                    <td colSpan={7} style={{ textAlign: 'right' }}>Grand Total</td>
                    <td className="text-right">
                      Rs. {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                      <td></td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="footer">
              <span>
                <strong>{subscribers.length}</strong> subscribers &bull;{' '}
                <strong>{activeCount}</strong> active
              </span>
              <span>SubTrack Management System</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
