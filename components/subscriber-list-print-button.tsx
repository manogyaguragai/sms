'use client';

import { useState } from 'react';
import { getAllSubscribersForPrint, type SubscriberPrintData } from '@/app/actions/print-actions';
import { formatNepaliDate } from '@/lib/nepali-date';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';

export function SubscriberListPrintButton() {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const subscribers = await getAllSubscribersForPrint();
      const grandTotal = subscribers.reduce((sum, s) => sum + s.total_paid, 0);
      const activeCount = subscribers.filter(s => s.status === 'active').length;
      const printDateStr = formatNepaliDate(new Date(), 'full');

      const rows = subscribers.map((sub, index) => `
        <tr>
          <td class="sn">${index + 1}</td>
          <td style="font-weight:500">${sub.full_name}</td>
          <td>${sub.phone || '—'}</td>
          <td><span class="badge badge-${sub.status}">${sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}</span></td>
          <td><span class="badge badge-${sub.frequency}">${sub.frequency.charAt(0).toUpperCase() + sub.frequency.slice(1)}</span></td>
          <td class="text-center">${sub.payment_count}</td>
          <td class="text-right" style="font-weight:500">Rs. ${sub.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>${sub.last_payment_date ? formatNepaliDate(sub.last_payment_date, 'short') : '—'}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Subscriber List</title>
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
            .header p { font-size: 11px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
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
            thead th:first-child { border-radius: 4px 0 0 0; }
            thead th:last-child { border-radius: 0 4px 0 0; }
            tbody td {
              padding: 6px 10px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 11px;
            }
            tbody tr:nth-child(even) { background: #f8f9fa; }
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
            .badge-active { background: #dcfce7; color: #166534; }
            .badge-inactive, .badge-expired, .badge-cancelled { background: #fee2e2; color: #991b1b; }
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
            .footer strong { color: #1a1a2e; }
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
          <div class="header">
            <h1>Subscriber List</h1>
            <p>Generated on ${printDateStr} &bull; Total: ${subscribers.length} subscribers (${activeCount} active)</p>
          </div>
          <table>
            <thead>
              <tr>
                <th class="sn">S.N.</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Type</th>
                <th>Payments</th>
                <th class="text-right">Total Paid</th>
                <th>Last Payment</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="total-row">
                <td colspan="6" style="text-align:right">Grand Total</td>
                <td class="text-right">Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <span><strong>${subscribers.length}</strong> subscribers &bull; <strong>${activeCount}</strong> active</span>
            <span>SubTrack Management System</span>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=1000,height=700');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    } catch (error) {
      console.error('Error printing subscriber list:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handlePrint}
      disabled={loading}
      className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Printer className="w-4 h-4 mr-2" />
      )}
      Print List
    </Button>
  );
}
