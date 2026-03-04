'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { getAllSubscribersForPrint, type SubscriberPrintData } from '@/app/actions/print-actions';
import { formatNepaliDate } from '@/lib/nepali-date';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Printer, Loader2, Search, Filter, X } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';

interface PrintSubscriberListProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'border-green-200 text-green-700 bg-green-50' },
  { value: 'inactive', label: 'Inactive', color: 'border-red-200 text-red-700 bg-red-50' },
];

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly', color: 'border-blue-200 text-blue-700 bg-blue-50' },
  { value: 'annually', label: 'Annually', color: 'border-green-200 text-green-700 bg-green-50' },
  { value: '12_hajar', label: '12 Hajar', color: 'border-purple-200 text-purple-700 bg-purple-50' },
];

export function PrintSubscriberList({ open, onClose }: PrintSubscriberListProps) {
  const [loading, setLoading] = useState(false);
  const [allSubscribers, setAllSubscribers] = useState<SubscriberPrintData[]>([]);
  const [fetched, setFetched] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['active', 'inactive']);
  const [selectedFrequencies, setSelectedFrequencies] = useState<string[]>(['monthly', 'annually', '12_hajar']);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getAllSubscribersForPrint();
      setAllSubscribers(data);
      setFetched(true);
    } catch (error) {
      console.error('Error fetching print data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when dialog opens
  useEffect(() => {
    if (open && !fetched) {
      fetchData();
    }
  }, [open]);

  // Reset when dialog closes
  const handleClose = () => {
    setFetched(false);
    setAllSubscribers([]);
    setSearchQuery('');
    setSelectedStatuses(['active', 'inactive']);
    setSelectedFrequencies(['monthly', 'annually', '12_hajar']);
    onClose();
  };

  // Apply filters
  const filteredSubscribers = useMemo(() => {
    return allSubscribers.filter(sub => {
      // Status filter
      if (!selectedStatuses.includes(sub.status)) return false;

      // Frequency filter
      const subFreqs = Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency];
      const hasMatchingFreq = subFreqs.some(f => selectedFrequencies.includes(f));
      if (!hasMatchingFreq) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = sub.full_name.toLowerCase().includes(q);
        const phoneMatch = sub.phone?.toLowerCase().includes(q) || false;
        if (!nameMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [allSubscribers, selectedStatuses, selectedFrequencies, searchQuery]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleFrequency = (freq: string) => {
    setSelectedFrequencies(prev =>
      prev.includes(freq) ? prev.filter(f => f !== freq) : [...prev, freq]
    );
  };

  const handlePrint = () => {
    const today = new NepaliDate(new Date());
    const todayStr = `${today.getYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const printDateStr = formatNepaliDate(new Date(), 'full');

    const grandTotal = filteredSubscribers.reduce((sum, s) => sum + s.total_paid, 0);
    const activeCount = filteredSubscribers.filter(s => s.status === 'active').length;

    // Build filter description for print
    const allStatuses = selectedStatuses.length === STATUS_OPTIONS.length;
    const allFreqs = selectedFrequencies.length === FREQUENCY_OPTIONS.length;
    const filterParts: string[] = [];
    if (!allStatuses) filterParts.push(`Status: ${selectedStatuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`);
    if (!allFreqs) filterParts.push(`Type: ${selectedFrequencies.map(f => f === '12_hajar' ? '12 Hajar' : f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}`);
    if (searchQuery.trim()) filterParts.push(`Search: "${searchQuery.trim()}"`);
    const filterDesc = filterParts.length > 0 ? filterParts.join(' • ') : 'All Subscribers';

    const rows = filteredSubscribers.map((sub, index) => `
      <tr>
        <td class="sn">${index + 1}</td>
        <td style="font-weight:500">${sub.full_name}</td>
        <td>${sub.phone || '—'}</td>
        <td><span class="badge badge-${sub.status}">${sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}</span></td>
        <td>${(Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency]).map((f: string) => `<span class="badge badge-${f}">${f === '12_hajar' ? '12 Hajar' : f.charAt(0).toUpperCase() + f.slice(1)}</span>`).join(' ')}</td>
        <td>Rs. ${Number(sub.monthly_rate).toLocaleString()}</td>
        <td class="text-center">${sub.payment_count}</td>
        <td class="text-right" style="font-weight:500">Rs. ${sub.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>${sub.last_payment_date ? formatNepaliDate(sub.last_payment_date, 'short') : '—'}</td>
        <td>${sub.subscription_end_date ? formatNepaliDate(sub.subscription_end_date, 'short') : '—'}</td>
      </tr>
    `).join('');

    const html = `
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
          .header p { font-size: 11px; color: #555; }
          .filter-info {
            display: inline-block;
            padding: 4px 12px;
            background: #eef2ff;
            border: 1px solid #c7d2fe;
            border-radius: 4px;
            font-size: 10px;
            color: #4338ca;
            font-weight: 600;
            margin-bottom: 12px;
          }
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
          .badge-annually { background: #dcfce7; color: #166534; }
          .badge-12_hajar { background: #f3e8ff; color: #6b21a8; }
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
          <p>Generated on ${printDateStr} &bull; Total: ${filteredSubscribers.length} subscribers (${activeCount} active)</p>
        </div>
        <div class="filter-info">Filters: ${filterDesc}</div>
        <table>
          <thead>
            <tr>
              <th class="sn">S.N.</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Type</th>
              <th>Rate</th>
              <th>Payments</th>
              <th class="text-right">Total Paid</th>
              <th>Last Payment</th>
              <th>Sub. End Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="7" style="text-align:right">Grand Total</td>
              <td class="text-right">Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          <span><strong>${filteredSubscribers.length}</strong> subscribers &bull; <strong>${activeCount}</strong> active</span>
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
  };

  const grandTotal = filteredSubscribers.reduce((sum, s) => sum + s.total_paid, 0);
  const activeCount = filteredSubscribers.filter(s => s.status === 'active').length;
  const printDateStr = formatNepaliDate(new Date(), 'full');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white border-gray-200 w-[95vw] sm:max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        {/* Sticky Header with Filters */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-gray-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                Print Subscriber List
              </DialogTitle>
              <Button
                onClick={handlePrint}
                disabled={loading || filteredSubscribers.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print ({filteredSubscribers.length})
              </Button>
            </div>
          </DialogHeader>

          {/* Filter Controls */}
          <div className="mt-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Status Filter */}
              <div className="flex-1 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-2">
                  <Filter className="w-3.5 h-3.5" />
                  Status:
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex items-center space-x-1.5">
                      <Checkbox
                        id={`status-${opt.value}`}
                        checked={selectedStatuses.includes(opt.value)}
                        onCheckedChange={() => toggleStatus(opt.value)}
                      />
                      <label htmlFor={`status-${opt.value}`} className="cursor-pointer select-none">
                        <Badge variant="outline" className={`text-xs px-2 py-0.5 ${opt.color}`}>
                          {opt.label}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frequency Filter */}
              <div className="flex-1 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-2">
                  <Filter className="w-3.5 h-3.5" />
                  Subscription Type:
                </div>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCY_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex items-center space-x-1.5">
                      <Checkbox
                        id={`freq-${opt.value}`}
                        checked={selectedFrequencies.includes(opt.value)}
                        onCheckedChange={() => toggleFrequency(opt.value)}
                      />
                      <label htmlFor={`freq-${opt.value}`} className="cursor-pointer select-none">
                        <Badge variant="outline" className={`text-xs px-2 py-0.5 ${opt.color}`}>
                          {opt.label}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Summary */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing <strong className="text-gray-900">{filteredSubscribers.length}</strong> of{' '}
                <strong className="text-gray-700">{allSubscribers.length}</strong> subscribers
                ({activeCount} active)
              </span>
              {(selectedStatuses.length < STATUS_OPTIONS.length ||
                selectedFrequencies.length < FREQUENCY_OPTIONS.length ||
                searchQuery.trim()) && (
                  <button
                    onClick={() => {
                      setSelectedStatuses(['active', 'inactive']);
                      setSelectedFrequencies(['monthly', 'annually', '12_hajar']);
                      setSearchQuery('');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Reset Filters
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-500">Loading subscriber data...</span>
            </div>
          ) : (
            <div ref={printRef}>
                {filteredSubscribers.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Filter className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No subscribers match the current filters.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-900 text-white">
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-10 text-center">S.N.</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Phone</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Rate</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider">Payments</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">Total Paid</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Last Payment</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">Sub. End Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredSubscribers.map((sub, index) => (
                              <tr key={sub.id} className={index % 2 === 1 ? 'bg-gray-50' : ''}>
                                <td className="px-3 py-2 text-center text-gray-500 text-xs">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{sub.full_name}</td>
                                <td className="px-3 py-2 text-gray-600">{sub.phone || '—'}</td>
                                <td className="px-3 py-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${sub.status === 'active'
                                      ? 'border-green-200 text-green-700 bg-green-50'
                                      : 'border-red-200 text-red-700 bg-red-50'
                                      }`}
                                  >
                                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {(Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency]).map((f: string) => (
                                      <Badge
                                        key={f}
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 ${f === 'monthly' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                          f === 'annually' ? 'border-green-200 text-green-700 bg-green-50' :
                                            f === '12_hajar' ? 'border-purple-200 text-purple-700 bg-purple-50' :
                                              'border-gray-200 text-gray-600 bg-gray-50'
                                          }`}
                                      >
                                        {f === '12_hajar' ? '12 Hajar' : f.charAt(0).toUpperCase() + f.slice(1)}
                                      </Badge>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-gray-600">Rs. {Number(sub.monthly_rate).toLocaleString()}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{sub.payment_count}</td>
                                <td className="px-3 py-2 text-right font-medium text-gray-900">
                                  Rs. {sub.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {sub.last_payment_date ? formatNepaliDate(sub.last_payment_date, 'short') : '—'}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {sub.subscription_end_date ? formatNepaliDate(sub.subscription_end_date, 'short') : '—'}
                                </td>
                              </tr>
                            ))}
                            {/* Grand Total Row */}
                            <tr className="bg-blue-50 border-t-2 border-gray-900">
                              <td colSpan={7} className="px-3 py-2.5 text-right font-bold text-gray-900">Grand Total</td>
                              <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                                Rs. {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td></td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Footer */}
                      <div className="flex justify-between items-center mt-4 text-xs text-gray-500 border-t border-gray-200 pt-3">
                        <span>
                          <strong className="text-gray-700">{filteredSubscribers.length}</strong> subscribers •{' '}
                          <strong className="text-gray-700">{activeCount}</strong> active
                        </span>
                        <span>Generated on {printDateStr} • SubTrack Management System</span>
                      </div>
                  </>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
