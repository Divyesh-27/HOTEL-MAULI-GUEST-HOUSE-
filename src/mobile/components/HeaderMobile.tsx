import React from 'react';
import SyncStatusIndicator from './SyncStatusIndicator';

const HeaderMobile: React.FC = () => {
  return (
    <div className="mobile-header">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-extrabold text-foreground tracking-tight leading-tight">
            HOTEL MAULI GUEST HOUSE
          </h1>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
            T Point, Renuka Devi Road, Mahurgad
          </p>
        </div>
        <div className="flex-shrink-0 ml-3">
          <SyncStatusIndicator />
        </div>
      </div>
    </div>
  );
};

export default HeaderMobile;
