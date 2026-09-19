import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeToDayStr } from '@/utils/availabilityUtils';
import BottomSheet from '@/mobile/components/BottomSheet';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, CalendarRange, Clock } from 'lucide-react';
import { DateRange } from 'react-day-picker';

type DateMode = 'today' | 'specific' | 'range';

interface DateFilterControlProps {
  onDateChange: (date: string | null, dateEnd: string | null) => void;
}

const DateFilterControl: React.FC<DateFilterControlProps> = ({ onDateChange }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DateMode>('today');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(new Date().setDate(new Date().getDate() + 1)),
  });

  const handleModeChange = (newMode: DateMode) => {
    setMode(newMode);
    if (newMode === 'today') {
      onDateChange(null, null);
      setOpen(false);
    }
  };

  const handleApply = () => {
    if (mode === 'specific' && date) {
      onDateChange(normalizeToDayStr(date), null);
    } else if (mode === 'range' && dateRange?.from && dateRange?.to) {
      onDateChange(normalizeToDayStr(dateRange.from), normalizeToDayStr(dateRange.to));
    }
    setOpen(false);
  };

  // Determine button label
  let buttonLabel = 'Today';
  let buttonIcon = <Clock className="w-3.5 h-3.5" />;
  if (mode === 'specific' && date) {
    buttonLabel = normalizeToDayStr(date);
    buttonIcon = <CalendarIcon className="w-3.5 h-3.5" />;
  } else if (mode === 'range' && dateRange?.from) {
    buttonLabel = `${normalizeToDayStr(dateRange.from)} — ${dateRange.to ? normalizeToDayStr(dateRange.to) : 'Select'}`;
    buttonIcon = <CalendarRange className="w-3.5 h-3.5" />;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-lg text-sm font-medium shadow-sm active:scale-95 transition-transform"
      >
        {buttonIcon}
        {buttonLabel}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Select Date or Range">
        <div className="space-y-4 pt-2">
          {/* Calendar View - Pure white, clean border */}
          <div className="flex justify-center bg-white border border-gray-200 shadow-sm rounded-xl p-4 text-slate-900 overflow-hidden">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                if (range?.from && range?.to && range.from > range.to) {
                  setDateRange({ from: range.to, to: range.from });
                } else {
                  setDateRange(range);
                }
              }}
              className="rounded-md"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                onDateChange(null, null);
                setDateRange({ from: new Date(), to: undefined });
                setOpen(false);
              }}
              className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-lg font-bold text-sm m-touch-target active:scale-95 transition-transform"
            >
              Reset to Today
            </button>
            <button
              onClick={() => {
                if (dateRange?.from) {
                  onDateChange(normalizeToDayStr(dateRange.from), dateRange.to ? normalizeToDayStr(dateRange.to) : null);
                }
                setOpen(false);
              }}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-bold text-sm m-touch-target shadow-sm active:scale-95 transition-transform"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};

export default DateFilterControl;
