import React, { useState, useMemo } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { HistoryRecord } from '@/types';
import SearchBar from '@/mobile/components/SearchBar';
import EmptyState from '@/mobile/components/EmptyState';
import GuestDetailsBottomSheet from '@/mobile/components/GuestDetailsBottomSheet';
import { Clock, Eye } from 'lucide-react';

const HistoryMobile: React.FC = () => {
  const history = useMobileStore((s) => s.history);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewDetails, setViewDetails] = useState<HistoryRecord | null>(null);

  const filteredHistory = useMemo(() => {
    let list = history;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(record => 
        record.guestName.toLowerCase().includes(term) ||
        record.mobile.includes(term) ||
        record.roomNos.some(room => room.toLowerCase().includes(term))
      );
    }
    // Sort by checkout date (newest first)
    return list.sort((a, b) => {
      const aDate = new Date(a.checkoutDate || a.checkOut || a.checkIn).getTime();
      const bDate = new Date(b.checkoutDate || b.checkOut || b.checkIn).getTime();
      return bDate - aDate;
    });
  }, [history, searchTerm]);

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* Search */}
      <div className="bg-card p-3 rounded-xl border">
        <SearchBar 
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search history by name, mobile..."
        />
      </div>

      {/* History Cards */}
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-6 h-6" />}
            title="No history found"
            description={searchTerm ? "Try a different search term" : "Checked-out guests will appear here"}
          />
        ) : (
          filteredHistory.map(record => (
            <div key={record.id} className="bg-card border rounded-xl p-4 active:scale-[0.98] transition-transform">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{record.guestName}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{record.mobile}</p>
                </div>
                <div className="bg-secondary text-foreground px-2 py-1 rounded text-xs font-black">
                  {record.roomNos.join(', ')}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[11px] mb-3 p-2.5 bg-secondary/30 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block mb-0.5 uppercase tracking-wider font-bold text-[9px]">In</span>
                  <span className="font-semibold">{new Date(record.checkIn).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5 uppercase tracking-wider font-bold text-[9px]">Out</span>
                  <span className="font-semibold">
                    {(record.checkoutDate || record.checkOut) 
                      ? new Date(record.checkoutDate || record.checkOut!).toLocaleDateString() 
                      : 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-end border-t border-border pt-3">
                <div className="text-xs">
                  <span className="text-muted-foreground block mb-0.5">Total Paid</span>
                  <span className="font-bold text-primary text-sm">₹{record.totalPaid || record.finalAmount || 0}</span>
                </div>
                
                <button
                  onClick={() => setViewDetails(record)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-secondary text-foreground font-bold text-xs active:scale-95 transition-transform"
                >
                  <Eye className="w-3.5 h-3.5" /> Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <GuestDetailsBottomSheet 
        data={viewDetails} 
        onClose={() => setViewDetails(null)} 
        isHistory={true}
      />
    </div>
  );
};

export default HistoryMobile;
