import React, { useState, useEffect } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { refreshFromCloud } from '@/mobile/lib/mobileSyncEngine';

const OfflineBanner: React.FC = () => {
  const syncStatus = useMobileStore(s => s.syncStatus);
  const isOnline = useMobileStore(s => s.isOnline);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // If we are online and sync is idle/success, we don't show the banner.
  if (isOnline && (syncStatus === 'idle' || syncStatus === 'success')) {
    return null;
  }

  const handleManualSync = async () => {
    setIsRefreshing(true);
    await refreshFromCloud();
    setIsRefreshing(false);
  };

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-[100] px-4 py-1.5 flex items-center justify-between text-[11px] font-bold shadow-md transition-transform",
      !isOnline ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-amber-950",
    )}>
      <div className="flex items-center gap-2">
        {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
        <span>
          {!isOnline 
            ? "You are offline. Changes saved locally." 
            : syncStatus === 'syncing' 
              ? "Syncing data with server..." 
              : "Sync error. Retrying..."
          }
        </span>
      </div>
      
      {isOnline && syncStatus === 'error' && (
        <button 
          onClick={handleManualSync}
          disabled={isRefreshing}
          className="px-2 py-0.5 rounded bg-amber-950/20 hover:bg-amber-950/30 active:scale-95 transition-all"
        >
          {isRefreshing ? 'Retrying...' : 'Retry Now'}
        </button>
      )}
    </div>
  );
};

export default OfflineBanner;
