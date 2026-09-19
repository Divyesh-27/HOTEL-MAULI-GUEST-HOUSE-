/**
 * Diagnostics & Synchronization Hook — Phase 3 Rebuild
 * 
 * Reports accurate real-time diagnostics (`Connected`, `Offline`, `Synchronizing`, `Retrying`, `Queue Size`)
 * without blocking UI rendering or making heavy Firestore/Supabase full-table pulls.
 * 
 * Provides backwards-compatible flags (`isSyncing`, `lastSynced`, `syncError`, `isConnected`, `executeSync`)
 * so existing UI components (`Header.tsx`) operate cleanly with zero layout modifications.
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  startSyncEngine, 
  getQueueSize, 
  getCurrentStatus, 
  getLastSuccessfulSync, 
  SyncDiagnostics 
} from '@/lib/syncEngine';
import { subscribeToRealtime, unsubscribeFromRealtime } from '@/lib/realtimeSync';
import { isSupabaseAvailable } from '@/lib/supabaseBridge';

export const useSync = () => {
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics>({
    status: 'Offline',
    pendingChanges: 0,
    queueSize: 0,
    lastSuccessfulSync: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
  });

  const refreshDiagnostics = useCallback(async () => {
    const status = getCurrentStatus();
    const lastSuccess = getLastSuccessfulSync();
    const queueCount = await getQueueSize();
    const online = typeof navigator !== 'undefined' ? navigator.onLine : false;

    setDiagnostics({
      status,
      pendingChanges: queueCount,
      queueSize: queueCount,
      lastSuccessfulSync: lastSuccess,
      isOnline: online,
    });
  }, []);

  useEffect(() => {
    // 1. Start the SQLite queue worker & Supabase Realtime bridge on mount
    startSyncEngine();
    subscribeToRealtime();

    // 2. Refresh diagnostics initially and every 2 seconds
    refreshDiagnostics();
    const interval = setInterval(() => {
      refreshDiagnostics();
    }, 2000);

    return () => {
      clearInterval(interval);
      unsubscribeFromRealtime();
    };
  }, [refreshDiagnostics]);

  const executeSync = useCallback(async () => {
    // Kick background sync engine immediately
    startSyncEngine();
    await refreshDiagnostics();
  }, [refreshDiagnostics]);

  // Derive backwards-compatible flags for Header UI
  const isSyncing = diagnostics.status === 'Synchronizing' || diagnostics.status === 'Retrying';
  const isConnected = diagnostics.isOnline && isSupabaseAvailable() && diagnostics.status !== 'Offline' && diagnostics.status !== 'Waiting For Internet';
  const syncError = diagnostics.status === 'Retrying' ? 'Retrying failed uploads...' : 
                    diagnostics.status === 'Waiting For Internet' ? 'Offline (Waiting for network)' : null;
  const lastSynced = diagnostics.lastSuccessfulSync ? new Date(diagnostics.lastSuccessfulSync) : null;

  return {
    ...diagnostics,
    isSyncing,
    lastSynced,
    syncError,
    isConnected,
    executeSync,
  };
};
