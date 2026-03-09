import { createClient } from '@/lib/supabase/server';
import NepaliDate from 'nepali-date-converter';
import { ChurnTimelineChart } from '@/components/churn-timeline-chart';
import type { ChurnTimelineData } from '@/components/churn-timeline-chart';
import { getCurrentNepaliDate } from '@/lib/nepali-date';

// Nepali month names for parsing payment notes
const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

/**
 * Parse all Nepali month/year periods from a payment's notes field.
 */
function parsePeriodsFromNotes(notes: string): { month: number; year: number }[] {
  const results: { month: number; year: number }[] = [];
  const regex = /([A-Za-z]+)\s+(\d{4})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(notes)) !== null) {
    const monthIndex = NEPALI_MONTHS.findIndex(
      m => m.toLowerCase() === match![1].toLowerCase()
    );
    const year = parseInt(match![2], 10);
    if (monthIndex !== -1 && !isNaN(year)) {
      results.push({ month: monthIndex, year });
    }
  }
  return results;
}

/**
 * Get all covered Nepali month/year periods from a payment record.
 */
function getPeriodsFromPayment(payment: {
  notes: string | null;
  payment_for_period: string | null;
}): { month: number; year: number }[] {
  if (payment.notes) {
    const fromNotes = parsePeriodsFromNotes(payment.notes);
    if (fromNotes.length > 0) return fromNotes;
  }
  if (payment.payment_for_period) {
    try {
      const date = new Date(payment.payment_for_period);
      const nd = new NepaliDate(date);
      return [{ month: nd.getMonth(), year: nd.getYear() }];
    } catch {
      // ignore
    }
  }
  return [];
}

function normalizeFreq(f: string): string {
  if (f === 'annually') return 'annual';
  return f;
}

interface SubscriberInfo {
  id: string;
  full_name: string;
  frequency: string[];
}

interface PaymentInfo {
  subscriber_id: string;
  notes: string | null;
  payment_for_period: string | null;
  payment_for: string | null;
  payment_date: string | null;
}

/**
 * Compute churn timeline data.
 *
 * Monthly: year → 12 months of data points (monthly progression).
 * Annual / 12 Hajar: flat array of data points (yearly progression, each point = a year).
 *
 * "Newly churned" = was active in previous data point but not in current.
 * "Returned" = was churned in previous data point but active in current.
 */
function computeChurnData(
  allSubscribers: SubscriberInfo[],
  allPayments: PaymentInfo[]
): ChurnTimelineData {
  const frequencyTypes = ['monthly', 'annual', '12_hajar'];

  // Build subscriber lists per frequency
  const subscribersByFreq = new Map<string, SubscriberInfo[]>();
  for (const freq of frequencyTypes) {
    const subs = allSubscribers.filter(s => {
      const freqs = (Array.isArray(s.frequency) ? s.frequency : [s.frequency]).map(normalizeFreq);
      return freqs.includes(freq);
    });
    subscribersByFreq.set(freq, subs);
  }

  // Build payment covered periods: freq -> subscriberId -> Set of "year-month" keys
  const coveredPeriods = new Map<string, Map<string, Set<string>>>();
  for (const freq of frequencyTypes) {
    coveredPeriods.set(freq, new Map());
  }

  for (const payment of allPayments) {
    const periods = getPeriodsFromPayment(payment);
    if (periods.length === 0) continue;

    let paymentFreqs: string[];
    if (payment.payment_for) {
      paymentFreqs = [normalizeFreq(payment.payment_for)];
    } else {
      const sub = allSubscribers.find(s => s.id === payment.subscriber_id);
      if (!sub) continue;
      paymentFreqs = (Array.isArray(sub.frequency) ? sub.frequency : [sub.frequency]).map(normalizeFreq);
    }

    for (const freq of paymentFreqs) {
      if (!frequencyTypes.includes(freq)) continue;
      const freqMap = coveredPeriods.get(freq)!;
      if (!freqMap.has(payment.subscriber_id)) {
        freqMap.set(payment.subscriber_id, new Set());
      }
      const periodSet = freqMap.get(payment.subscriber_id)!;
      for (const p of periods) {
        periodSet.add(`${p.year}-${p.month}`);
      }
    }
  }

  // Collect all years from covered periods
  const allYears = new Set<number>();
  for (const freqMap of coveredPeriods.values()) {
    for (const periodSet of freqMap.values()) {
      for (const key of periodSet) {
        const year = parseInt(key.split('-')[0], 10);
        if (!isNaN(year)) allYears.add(year);
      }
    }
  }
  const currentNepali = new NepaliDate(new Date());
  allYears.add(currentNepali.getYear());
  const sortedYears = Array.from(allYears).sort((a, b) => a - b);

  const result: ChurnTimelineData = {};

  for (const freq of frequencyTypes) {
    const freqSubs = subscribersByFreq.get(freq) || [];
    const freqCoveredPeriods = coveredPeriods.get(freq)!;
    const isYearly = freq === 'annual' || freq === '12_hajar';

    if (isYearly) {
      // ─── Yearly progression: each data point = a year ───
      const dataPoints: ChurnTimelineData[string]['series'][string] = [];
      let prevActiveIds = new Set<string>();

      for (const year of sortedYears) {
        const active: { id: string; name: string }[] = [];
        const churned: { id: string; name: string }[] = [];
        const currentActiveIds = new Set<string>();

        for (const sub of freqSubs) {
          const subPeriods = freqCoveredPeriods.get(sub.id);
          let isActive = false;
          if (subPeriods) {
            for (const key of subPeriods) {
              const pYear = parseInt(key.split('-')[0], 10);
              if (pYear === year) { isActive = true; break; }
            }
          }

          if (isActive) {
            active.push({ id: sub.id, name: sub.full_name });
            currentActiveIds.add(sub.id);
          } else {
            churned.push({ id: sub.id, name: sub.full_name });
          }
        }

        // Newly churned = was active in previous point, not active now
        const newlyChurned = churned.filter(s => prevActiveIds.has(s.id));
        // Returned = was not active in previous point (or was churned), active now
        const returned = active.filter(s => prevActiveIds.size > 0 && !prevActiveIds.has(s.id));

        dataPoints.push({
          label: String(year),
          index: year,
          activeCount: active.length,
          churnedCount: churned.length,
          newlyChurnedCount: newlyChurned.length,
          returnedCount: returned.length,
          totalCount: freqSubs.length,
          activeSubscribers: active,
          churnedSubscribers: churned,
          newlyChurnedSubscribers: newlyChurned,
          returnedSubscribers: returned,
        });

        prevActiveIds = currentActiveIds;
      }

      result[freq] = {
        isYearly: true,
        series: { all: dataPoints },
      };
    } else {
      // ─── Monthly progression: year → 12 months ───
      const yearData: Record<string, ChurnTimelineData[string]['series'][string]> = {};

      for (const year of sortedYears) {
        const months: ChurnTimelineData[string]['series'][string] = [];
        let prevActiveIds = new Set<string>();

        // For the first month of this year, get previous month's actives (last month of prev year)
        if (yearData[String(year - 1)]?.length === 12) {
          const prevYearLastMonth = yearData[String(year - 1)][11];
          prevActiveIds = new Set(prevYearLastMonth.activeSubscribers.map(s => s.id));
        }

        for (let m = 0; m < 12; m++) {
          const active: { id: string; name: string }[] = [];
          const churned: { id: string; name: string }[] = [];
          const currentActiveIds = new Set<string>();

          for (const sub of freqSubs) {
            const subPeriods = freqCoveredPeriods.get(sub.id);
            const isActive = !!subPeriods?.has(`${year}-${m}`);

            if (isActive) {
              active.push({ id: sub.id, name: sub.full_name });
              currentActiveIds.add(sub.id);
            } else {
              churned.push({ id: sub.id, name: sub.full_name });
            }
          }

          // Newly churned = was active last month, not active now
          const newlyChurned = churned.filter(s => prevActiveIds.has(s.id));
          // Returned = was churned last month, active now
          const returned = active.filter(s => prevActiveIds.size > 0 && !prevActiveIds.has(s.id));

          months.push({
            label: NEPALI_MONTHS[m],
            index: m,
            activeCount: active.length,
            churnedCount: churned.length,
            newlyChurnedCount: newlyChurned.length,
            returnedCount: returned.length,
            totalCount: freqSubs.length,
            activeSubscribers: active,
            churnedSubscribers: churned,
            newlyChurnedSubscribers: newlyChurned,
            returnedSubscribers: returned,
          });

          prevActiveIds = currentActiveIds;
        }

        yearData[String(year)] = months;
      }

      result[freq] = {
        isYearly: false,
        series: yearData,
      };
    }
  }

  return result;
}

async function getChurnTimelineData() {
  const supabase = await createClient();

  const [{ data: allSubscribers }, { data: allPayments }] = await Promise.all([
    supabase
      .from('subscribers')
      .select('id, full_name, frequency'),
    supabase
      .from('payments')
      .select('subscriber_id, notes, payment_for_period, payment_for, payment_date'),
  ]);

  const subscribers: SubscriberInfo[] = (allSubscribers || []).map(s => ({
    id: s.id,
    full_name: s.full_name,
    frequency: Array.isArray(s.frequency) ? s.frequency : [s.frequency],
  }));

  const payments: PaymentInfo[] = (allPayments || []).map(p => ({
    subscriber_id: p.subscriber_id,
    notes: p.notes,
    payment_for_period: p.payment_for_period,
    payment_for: p.payment_for,
    payment_date: p.payment_date,
  }));

  return computeChurnData(subscribers, payments);
}

export default async function ChurnTimelinePage() {
  const churnData = await getChurnTimelineData();
  const nepaliNow = getCurrentNepaliDate();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Churn Timeline</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Track active subscriber counts across months to identify churn trends
        </p>
      </div>

      {/* Chart */}
      <ChurnTimelineChart
        data={churnData}
        currentYear={nepaliNow.year}
        currentMonth={nepaliNow.month}
      />
    </div>
  );
}
