import React, { useState, useEffect, useRef } from 'react';
import { refreshFromCloud } from '@/mobile/lib/mobileSyncEngine';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileStore } from '@/mobile/store/useMobileStore';

interface PullToRefreshWrapperProps {
  children: React.ReactNode;
}

const PullToRefreshWrapper: React.FC<PullToRefreshWrapperProps> = ({ children }) => {
  const [startY, setStartY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isOnline = useMobileStore(s => s.isOnline);
  const MAX_PULL = 80;
  const THRESHOLD = 60;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    
    const y = e.touches[0].clientY;
    const distance = y - startY;
    
    if (distance > 0) {
      // Prevent default scrolling when pulling down at the top
      if (e.cancelable) e.preventDefault();
      setPullDistance(Math.min(distance * 0.4, MAX_PULL));
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling) return;
    setPulling(false);
    
    if (pullDistance > THRESHOLD && isOnline) {
      setRefreshing(true);
      setPullDistance(50); // Hold at a fixed distance while refreshing
      
      try {
        await refreshFromCloud();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div 
      className="h-full w-full overflow-y-auto no-scrollbar relative"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 w-full flex justify-center items-end overflow-hidden transition-all duration-200 ease-out"
        style={{ height: `${pullDistance}px`, opacity: pullDistance / MAX_PULL }}
      >
        <div className="pb-3 flex flex-col items-center gap-2">
          <RefreshCw className={cn(
            "w-5 h-5 text-primary transition-all", 
            refreshing ? "animate-spin" : "",
            pullDistance > THRESHOLD ? "scale-110" : "scale-90 opacity-70"
          )} />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {refreshing ? 'Syncing...' : pullDistance > THRESHOLD ? 'Release to sync' : 'Pull down to sync'}
          </span>
        </div>
      </div>
      
      {/* Content wrapper that shifts down */}
      <div 
        className="min-h-full transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefreshWrapper;
