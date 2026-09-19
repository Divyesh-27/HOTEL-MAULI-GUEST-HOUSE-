import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Calendar, IndianRupee, Banknote, Smartphone } from 'lucide-react';

import { useShallow } from 'zustand/react/shallow';

import { toLocalDateTimeString, toLocalDateString } from '@/utils/dateUtils';

type ViewMode = 'daily' | 'monthly' | 'yearly';

/**
 * Defensively extracts normalized { ymd: 'YYYY-MM-DD', ym: 'YYYY-MM', year: 'YYYY' }
 * from any date string format (ISO-8601, localized M/D/YYYY, datetime-local, etc.)
 * in consistent local timezone.
 */
export const parseRevenueDate = (dateStr: string | null | undefined): { ymd: string; ym: string; year: string } | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. Convert via centralized local date/time helper to resolve UTC/midnight shifts
  const localDt = toLocalDateTimeString(trimmed);
  if (localDt && localDt.length >= 10) {
    const ymd = localDt.slice(0, 10);
    const ym = localDt.slice(0, 7);
    const year = localDt.slice(0, 4);
    return { ymd, ym, year };
  }

  // 2. Parse via new Date() for localized strings (e.g. "8/24/2026" or "8/24/2026, 5:30:00 PM")
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear().toString();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return {
      ymd: `${y}-${m}-${d}`,
      ym: `${y}-${m}`,
      year: y,
    };
  }

  // 3. Fallback regex for non-standard slash format (e.g. M/D/YYYY)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const part1 = slashMatch[1].padStart(2, '0');
    const part2 = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return {
      ymd: `${year}-${part1}-${part2}`,
      ym: `${year}-${part1}`,
      year: year,
    };
  }

  return null;
};

const Revenue = () => {
  const { history, bookings } = useStore(useShallow(state => ({
    history: state.history,
    bookings: state.bookings
  })));
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(toLocalDateString(new Date()).slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const revenueData = useMemo(() => {
    let cashTotal = 0;
    let onlineTotal = 0;
    let bookingCountSet = new Set<string>();

    const isMatch = (dateStr: string) => {
      const parts = parseRevenueDate(dateStr);
      if (!parts) return false;
      if (viewMode === 'daily') return parts.ymd === selectedDate;
      if (viewMode === 'monthly') return parts.ym === selectedMonth;
      if (viewMode === 'yearly') return parts.year === selectedYear;
      return false;
    };

    const processAdvance = (paymentList: any[], fallbackAdvance: number, fallbackDate: string, bId: string) => {
      if (paymentList && paymentList.length > 0) {
        paymentList.forEach(p => {
          if (isMatch(p.date)) {
            bookingCountSet.add(bId);
            if (!p.payMode || p.payMode.toLowerCase() === 'cash') cashTotal += p.amount;
            else onlineTotal += p.amount;
          }
        });
      } else if (fallbackAdvance > 0) {
        if (isMatch(fallbackDate)) {
          bookingCountSet.add(bId);
          cashTotal += fallbackAdvance; // default to cash if missing
        }
      }
    };

    // 1. Process active bookings (Advances only)
    bookings.forEach(b => {
      processAdvance(b.advancePayments, b.advance, b.checkIn, b.id);
    });

    // 2. Process history (Advances + Checkout Settlements)
    history.forEach(h => {
      // Advance Payments
      processAdvance(h.advancePayments, h.advance, h.checkIn, h.id);

      // Remaining Settlement at Checkout
      const advTotal = (h.advancePayments && h.advancePayments.length > 0) 
        ? h.advancePayments.reduce((acc, p) => acc + p.amount, 0)
        : h.advance || 0;
      
      const remaining = h.finalAmount - advTotal;
      if (remaining > 0 && isMatch(h.checkoutDate)) {
        bookingCountSet.add(h.id);
        if (!h.payMode || h.payMode.toLowerCase() === 'cash') cashTotal += remaining;
        else onlineTotal += remaining;
      }
    });

    return {
      total: cashTotal + onlineTotal,
      cash: cashTotal,
      online: onlineTotal,
      bookings: bookingCountSet.size,
    };
  }, [history, bookings, viewMode, selectedDate, selectedMonth, selectedYear]);

  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="animate-fade-in">
      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-6">
        {(['daily', 'monthly', 'yearly'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              viewMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Date Selector */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          {viewMode === 'daily' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
          {viewMode === 'monthly' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
          {viewMode === 'yearly' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
          <span className="text-sm text-muted-foreground">
            {revenueData.bookings} booking(s) found
          </span>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Revenue</p>
              <p className="text-3xl font-bold text-primary">₹{revenueData.total.toLocaleString()}</p>
            </div>
            <IndianRupee className="w-8 h-8 opacity-30 text-primary" />
          </div>
        </div>

        {/* Cash */}
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Cash</p>
              <p className="text-3xl font-bold text-status-available">₹{revenueData.cash.toLocaleString()}</p>
            </div>
            <Banknote className="w-8 h-8 opacity-30 text-status-available" />
          </div>
        </div>

        {/* Online */}
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Online</p>
              <p className="text-3xl font-bold text-status-reserved">₹{revenueData.online.toLocaleString()}</p>
            </div>
            <Smartphone className="w-8 h-8 opacity-30 text-status-reserved" />
          </div>
        </div>
      </div>

      {/* Payment Breakdown */}
      {revenueData.total > 0 && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 mt-6">
          <h4 className="font-bold text-sm text-muted-foreground uppercase mb-4">Payment Breakdown</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cash Payments</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-available transition-all"
                    style={{
                      width: `${revenueData.total > 0 ? (revenueData.cash / revenueData.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-mono w-16 text-right">
                  {revenueData.total > 0 ? Math.round((revenueData.cash / revenueData.total) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Online Payments</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-reserved transition-all"
                    style={{
                      width: `${revenueData.total > 0 ? (revenueData.online / revenueData.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-mono w-16 text-right">
                  {revenueData.total > 0 ? Math.round((revenueData.online / revenueData.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Revenue;
