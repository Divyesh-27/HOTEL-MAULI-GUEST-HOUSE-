import React, { useState, useMemo } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Calendar, IndianRupee, Banknote, Smartphone, TrendingUp } from 'lucide-react';
import SegmentedToggle from '@/mobile/components/SegmentedToggle';

type ViewMode = 'daily' | 'monthly' | 'yearly';

const RevenueMobile: React.FC = () => {
  const history = useMobileStore((s) => s.history);
  const bookings = useMobileStore((s) => s.bookings);

  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const revenueData = useMemo(() => {
    let cashTotal = 0;
    let onlineTotal = 0;
    let bookingCountSet = new Set<string>();

    const isMatch = (dateStr: string) => {
      if (!dateStr) return false;
      const d = dateStr.split('T')[0];
      if (viewMode === 'daily') return d === selectedDate;
      if (viewMode === 'monthly') return d.slice(0, 7) === selectedMonth;
      if (viewMode === 'yearly') return d.slice(0, 4) === selectedYear;
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
      processAdvance(h.advancePayments, h.advance, h.checkIn, h.id);

      const advTotal = (h.advancePayments && h.advancePayments.length > 0) 
        ? h.advancePayments.reduce((acc, p) => acc + p.amount, 0)
        : h.advance || 0;
      
      const remaining = (h.finalAmount || 0) - advTotal;
      if (remaining > 0 && isMatch(h.checkoutDate || h.checkOut || h.checkIn)) {
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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="animate-fade-in space-y-4 pb-8">
      {/* View Mode */}
      <SegmentedToggle
        options={[
          { id: 'daily', label: 'Daily' },
          { id: 'monthly', label: 'Monthly' },
          { id: 'yearly', label: 'Yearly' }
        ]}
        activeId={viewMode}
        onChange={(id) => setViewMode(id as ViewMode)}
      />

      {/* Date Picker */}
      <div className="bg-card p-3 rounded-xl border flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          {viewMode === 'daily' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-transparent font-bold focus:outline-none"
            />
          )}
          {viewMode === 'monthly' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-transparent font-bold focus:outline-none"
            />
          )}
          {viewMode === 'yearly' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-transparent font-bold focus:outline-none appearance-none"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded">
          {revenueData.bookings} Bookings
        </div>
      </div>

      {/* Total Revenue */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10">
          <TrendingUp className="w-32 h-32" />
        </div>
        <p className="text-sm font-bold opacity-90 uppercase tracking-wider mb-1">Total Revenue</p>
        <h2 className="text-4xl font-black tracking-tighter">₹{revenueData.total.toLocaleString()}</h2>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-status-available/10 p-1.5 rounded-lg">
              <Banknote className="w-4 h-4 text-status-available" />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase">Cash</span>
          </div>
          <p className="text-xl font-black text-foreground">₹{revenueData.cash.toLocaleString()}</p>
        </div>
        
        <div className="bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-status-reserved/10 p-1.5 rounded-lg">
              <Smartphone className="w-4 h-4 text-status-reserved" />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase">Online</span>
          </div>
          <p className="text-xl font-black text-foreground">₹{revenueData.online.toLocaleString()}</p>
        </div>
      </div>

      {/* Visual Bar */}
      {revenueData.total > 0 && (
        <div className="bg-card p-4 rounded-xl border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Payment Split</h4>
          <div className="flex h-3 rounded-full overflow-hidden mb-2">
            <div 
              className="bg-status-available transition-all" 
              style={{ width: `${(revenueData.cash / revenueData.total) * 100}%` }}
            />
            <div 
              className="bg-status-reserved transition-all" 
              style={{ width: `${(revenueData.online / revenueData.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
            <span>Cash: {Math.round((revenueData.cash / revenueData.total) * 100)}%</span>
            <span>Online: {Math.round((revenueData.online / revenueData.total) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueMobile;
