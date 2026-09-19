import React from 'react';
import { cn } from '@/lib/utils';
import { useMobileStore, SyncStatusType } from '@/mobile/store/useMobileStore';

const SYNC_CONFIG: Record<SyncStatusType, { label: string; dotClass: string }> = {
  synced: { label: 'Synced', dotClass: 'sync-dot-synced' },
  syncing: { label: 'Syncing…', dotClass: 'sync-dot-syncing' },
  offline: { label: 'Offline', dotClass: 'sync-dot-offline' },
  'sync-failed': { label: 'Sync Failed', dotClass: 'sync-dot-failed' },
  reconnecting: { label: 'Reconnecting…', dotClass: 'sync-dot-reconnecting' },
};

const SyncStatusIndicator: React.FC = () => {
  const syncStatus = useMobileStore((s) => s.syncStatus);
  const lastSyncedAt = useMobileStore((s) => s.lastSyncedAt);
  const config = SYNC_CONFIG[syncStatus];

  const formattedTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="sync-indicator">
      <span className={cn('sync-dot', config.dotClass)} />
      <span className={cn(
        'text-[10px]',
        syncStatus === 'synced' ? 'text-muted-foreground' : 
        syncStatus === 'offline' ? 'text-muted-foreground' :
        syncStatus === 'sync-failed' ? 'text-destructive' :
        'text-foreground'
      )}>
        {config.label}
        {syncStatus === 'offline' && formattedTime && (
          <span className="ml-1 text-muted-foreground/70">{formattedTime}</span>
        )}
      </span>
    </div>
  );
};

export default SyncStatusIndicator;
