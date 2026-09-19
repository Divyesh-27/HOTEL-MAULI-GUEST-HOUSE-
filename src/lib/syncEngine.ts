/**
 * Synchronization Engine — Phase 3
 * 
 * Lightweight, queue-based, background synchronization worker.
 * 
 * Architecture:
 *   User Action → SQLite Transaction → Sync Queue → Background Worker → Supabase
 * 
 * Rules:
 *   - SQLite is ALWAYS written BEFORE anything is uploaded.
 *   - Desktop ALWAYS wins on conflict.
 *   - Never blocks the UI.
 *   - Exponential backoff on failures.
 *   - Checksum to skip redundant uploads.
 *   - Media uploads happen asynchronously.
 *   - 30-day cloud retention for bookings.
 */
import { supabase, isSupabaseAvailable, uploadMediaToCloud } from '@/lib/supabaseBridge';
import { generateUUID } from '@/lib/uuid';

// ============================================================
// TYPES
// ============================================================
export interface SyncOperation {
  operation_id: string;
  module: string;       // 'bookings' | 'history' | 'rooms' | 'room_statuses' | 'staff' | 'staff_logs' | 'invoice_settings' | 'room_categories' | 'room_bed_types' | 'media'
  record_id: string;
  operation_type: string; // 'UPSERT' | 'DELETE'
  payload?: any;
  timestamp: string;
  retry_count?: number;
  status?: string;
  device?: string;
  checksum?: string;
}

export interface SyncDiagnostics {
  status: 'Connected' | 'Offline' | 'Synchronizing' | 'Retrying' | 'Waiting For Internet';
  pendingChanges: number;
  queueSize: number;
  lastSuccessfulSync: string | null;
  isOnline: boolean;
}

// ============================================================
// CHECKSUM
// ============================================================
export function generateRecordChecksum(payload: any): string {
  // Simple deterministic hash for change detection
  const str = JSON.stringify(payload, Object.keys(payload).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================================
// ELECTRON IPC HELPERS
// ============================================================
const api = () => (window as any).electronAPI;

async function enqueueToSQLite(op: SyncOperation): Promise<boolean> {
  if (!api()) return false;
  try {
    return await api().syncEnqueue(op);
  } catch (err) {
    console.error('[SyncEngine] Failed to enqueue:', err);
    return false;
  }
}

async function getPendingFromSQLite(): Promise<SyncOperation[]> {
  if (!api()) return [];
  try {
    return await api().syncGetPending();
  } catch (err) {
    return [];
  }
}

async function updateQueueStatus(operationId: string, status: string, errorMessage?: string): Promise<boolean> {
  if (!api()) return false;
  try {
    return await api().syncUpdateStatus(operationId, status, errorMessage);
  } catch (err) {
    return false;
  }
}

async function addSyncLog(log: any): Promise<void> {
  if (!api()) return;
  try {
    await api().syncAddLog(log);
  } catch (err) {}
}

export async function getQueueSize(): Promise<number> {
  if (!api()) return 0;
  try {
    return await api().syncGetQueueSize();
  } catch (err) {
    return 0;
  }
}

// ============================================================
// ENQUEUE — Called by store mutations after SQLite write
// ============================================================
export function enqueueSync(module: string, recordId: string, operationType: 'UPSERT' | 'DELETE', payload?: any): void {
  const checksum = payload ? generateRecordChecksum(payload) : undefined;
  const op: SyncOperation = {
    operation_id: generateUUID(),
    module,
    record_id: recordId,
    operation_type: operationType,
    payload,
    timestamp: new Date().toISOString(),
    device: 'desktop',
    checksum,
  };

  // Fire-and-forget — never block the UI
  enqueueToSQLite(op).then(ok => {
    if (ok) {
      // Kick the worker to process immediately
      triggerProcessing();
    }
  });
}

// Helper to detect 4xx deterministic client errors that will never succeed on retry
function isDeterministicClientError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return true;
  }
  const codeStr = String(status || '');
  if (['400', '401', '403', '404', '409', '422', 'PGRST116', '23505', '23503', '42P01', '42703'].includes(codeStr)) {
    return true;
  }
  const msg = (error.message || String(error)).toLowerCase();
  if (
    msg.includes('400') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('404') ||
    msg.includes('409') ||
    msg.includes('422') ||
    msg.includes('not found') ||
    msg.includes('jwt') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('violates foreign key') ||
    msg.includes('duplicate key') ||
    msg.includes('bad request') ||
    msg.includes('invalid input')
  ) {
    return true;
  }
  return false;
}

// ============================================================
// SUPABASE TABLE MAPPING & UPLOAD LOGIC
// ============================================================
async function executeSupabaseOperation(op: SyncOperation): Promise<{ success: boolean; error?: string; isDeterministic?: boolean }> {
  if (!supabase || !isSupabaseAvailable()) {
    return { success: false, error: 'Supabase not available' };
  }

  const { module, record_id, operation_type, payload } = op;

  try {
    if (operation_type === 'DELETE') {
      const { error } = await supabase.from(module).delete().eq('id', record_id);
      if (error) return { success: false, error: error.message, isDeterministic: isDeterministicClientError(error) };
      return { success: true };
    }

    // UPSERT
    if (!payload) return { success: false, error: 'No payload for UPSERT', isDeterministic: true };

    const record = {
      ...payload,
      id: record_id,
      updated_at: payload.updated_at || new Date().toISOString(),
      version: payload.version || 1,
      device: 'desktop',
      source: 'desktop',
    };

    const { error } = await supabase.from(module).upsert(record, { onConflict: 'id' });
    if (error) return { success: false, error: error.message, isDeterministic: isDeterministicClientError(error) };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error', isDeterministic: isDeterministicClientError(err) };
  }
}

// ============================================================
// MEDIA UPLOAD WORKER
// ============================================================
async function executeMediaUpload(op: SyncOperation): Promise<{ success: boolean; error?: string }> {
  if (!op.payload) return { success: false, error: 'No payload' };

  const { bucket, filePath, base64, bookingId, field } = op.payload;
  const url = await uploadMediaToCloud(bucket, filePath, base64);

  if (url) {
    // Update the booking record in Supabase with the uploaded URL
    if (supabase && bookingId && field) {
      await supabase.from('bookings').update({ [field]: url }).eq('id', bookingId);
    }
    return { success: true };
  }

  return { success: false, error: 'Upload returned null' };
}

// ============================================================
// BACKGROUND QUEUE PROCESSOR
// ============================================================
let isProcessing = false;
let processingTimer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let _lastSuccessfulSync: string | null = null;
let _currentStatus: SyncDiagnostics['status'] = 'Offline';

function getBackoffDelay(): number {
  // Exponential backoff: 5s → 10s → 20s → 40s → 80s (max)
  const baseDelay = 5000;
  const maxDelay = 80000;
  return Math.min(baseDelay * Math.pow(2, consecutiveFailures), maxDelay);
}

function triggerProcessing() {
  if (isProcessing) return;
  if (processingTimer) clearTimeout(processingTimer);

  // Small delay to batch rapid mutations
  processingTimer = setTimeout(() => processQueue(), 500);
}

async function processQueue() {
  if (isProcessing) return;
  if (!navigator.onLine) {
    _currentStatus = 'Waiting For Internet';
    return;
  }
  if (!isSupabaseAvailable()) {
    _currentStatus = 'Offline';
    return;
  }

  isProcessing = true;
  _currentStatus = 'Synchronizing';

  try {
    const pending = await getPendingFromSQLite();

    if (pending.length === 0) {
      _currentStatus = navigator.onLine && isSupabaseAvailable() ? 'Connected' : 'Offline';
      isProcessing = false;
      return;
    }

    let allSucceeded = true;

    for (const op of pending) {
      // Check max retries
      if ((op.retry_count || 0) >= 10) {
        await updateQueueStatus(op.operation_id, 'Failed', 'Max retries exceeded');
        await addSyncLog({
          module: op.module,
          record_id: op.record_id,
          operation: op.operation_type,
          result: 'Failed',
          retry_count: op.retry_count,
          error_message: 'Max retries exceeded',
        });
        continue;
      }

      await updateQueueStatus(op.operation_id, 'Uploading');
      const start = Date.now();

      let result: { success: boolean; error?: string; isDeterministic?: boolean };

      if (op.module === 'media') {
        result = await executeMediaUpload(op);
      } else {
        result = await executeSupabaseOperation(op);
      }

      const duration = Date.now() - start;

      if (result.success) {
        await updateQueueStatus(op.operation_id, 'Completed');
        await addSyncLog({
          module: op.module,
          record_id: op.record_id,
          operation: op.operation_type,
          result: 'Success',
          retry_count: op.retry_count || 0,
          duration_ms: duration,
        });
      } else if (result.isDeterministic) {
        // Deterministic 4xx client error: will not succeed on retry, mark permanently Failed
        console.warn(`[SyncEngine] Permanent client error on op ${op.operation_id} (${op.module}:${op.record_id}): ${result.error}`);
        await updateQueueStatus(op.operation_id, 'Failed', `Permanent client error: ${result.error}`);
        await addSyncLog({
          module: op.module,
          record_id: op.record_id,
          operation: op.operation_type,
          result: 'Failed',
          retry_count: op.retry_count || 0,
          duration_ms: duration,
          error_message: `Permanent client error: ${result.error}`,
        });
      } else {
        allSucceeded = false;
        await updateQueueStatus(op.operation_id, 'Retrying', result.error);
        await addSyncLog({
          module: op.module,
          record_id: op.record_id,
          operation: op.operation_type,
          result: 'Failed',
          retry_count: (op.retry_count || 0) + 1,
          duration_ms: duration,
          error_message: result.error,
        });
      }
    }

    if (allSucceeded) {
      consecutiveFailures = 0;
      _lastSuccessfulSync = new Date().toISOString();
      _currentStatus = 'Connected';
    } else {
      consecutiveFailures++;
      _currentStatus = 'Retrying';
      // Schedule retry with backoff
      const delay = getBackoffDelay();
      processingTimer = setTimeout(() => processQueue(), delay);
    }
  } catch (err) {
    consecutiveFailures++;
    _currentStatus = 'Retrying';
    const delay = getBackoffDelay();
    processingTimer = setTimeout(() => processQueue(), delay);
  } finally {
    isProcessing = false;
  }
}

// ============================================================
// CLOUD RETENTION CLEANUP (30-day policy)
// ============================================================
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

async function runCloudRetentionCleanup(): Promise<void> {
  if (!supabase || !isSupabaseAvailable()) return;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISO = cutoffDate.toISOString();

    // Delete bookings where checkout_date is older than 30 days
    // Only deletes from Supabase. NEVER touches SQLite.
    const { data: expiredBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id')
      .not('checkout_date', 'is', null)
      .lt('checkout_date', cutoffISO);

    if (fetchError) {
      console.warn('[Retention] Failed to fetch expired bookings:', fetchError.message);
      return;
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      console.log('[Retention] No expired bookings to clean up.');
      return;
    }

    const expiredIds = expiredBookings.map(b => b.id);

    // Delete expired bookings from Supabase
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.warn('[Retention] Failed to delete expired bookings:', deleteError.message);
    } else {
      console.log(`[Retention] Cleaned up ${expiredIds.length} expired bookings from Supabase.`);
    }

    // Clean expired sync logs from Supabase if table exists
    // (Best-effort, non-critical)
    await addSyncLog({
      module: 'retention',
      record_id: 'cleanup',
      operation: 'DELETE',
      result: 'Success',
      error_message: `Cleaned ${expiredIds.length} expired records`,
    });
  } catch (err) {
    console.warn('[Retention] Cleanup error:', err);
  }
}

function scheduleRetentionCleanup(): void {
  // Run once per day (24 hours)
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
  if (cleanupTimer) clearInterval(cleanupTimer);

  // Run immediately on first schedule, then every 24 hours
  setTimeout(() => {
    runCloudRetentionCleanup();
    cleanupTimer = setInterval(() => runCloudRetentionCleanup(), CLEANUP_INTERVAL) as any;
  }, 60000); // Wait 1 minute after startup before first cleanup
}

// ============================================================
// ROOM HOLDS CLEANUP
// ============================================================
let holdCleanupTimer: ReturnType<typeof setInterval> | null = null;

async function cleanupExpiredHolds(): Promise<void> {
  if (!supabase || !isSupabaseAvailable()) return;
  try {
    const nowISO = new Date().toISOString();
    await supabase.from('room_holds').delete().lt('expires_at', nowISO);
  } catch (err) {
    console.warn('[SyncEngine] Room holds cleanup failed:', err);
  }
}

function scheduleHoldCleanup(): void {
  if (holdCleanupTimer) clearInterval(holdCleanupTimer);
  holdCleanupTimer = setInterval(cleanupExpiredHolds, 60000); // Every minute
}

// ============================================================
// ONLINE/OFFLINE MONITORING
// ============================================================
let monitoringStarted = false;

function startNetworkMonitoring() {
  if (monitoringStarted || typeof window === 'undefined') return;
  monitoringStarted = true;

  window.addEventListener('online', () => {
    console.log('[SyncEngine] Internet restored. Processing queue...');
    _currentStatus = 'Connected';
    consecutiveFailures = 0;
    triggerProcessing();
  });

  window.addEventListener('offline', () => {
    console.log('[SyncEngine] Internet lost. Pausing sync.');
    _currentStatus = 'Waiting For Internet';
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = null;
    }
  });

  // Initial status
  _currentStatus = navigator.onLine && isSupabaseAvailable() ? 'Connected' : 'Offline';
}

// ============================================================
// ENGINE LIFECYCLE
// ============================================================
let engineStarted = false;

export function startSyncEngine(): void {
  if (engineStarted) return;
  engineStarted = true;

  startNetworkMonitoring();
  scheduleRetentionCleanup();
  scheduleHoldCleanup();

  // Process any pending items from previous session
  triggerProcessing();

  // Periodic queue check every 5 minutes
  setInterval(() => {
    if (!isProcessing && navigator.onLine) {
      triggerProcessing();
    }
  }, 5 * 60 * 1000);

  // Rotate sync logs daily
  if (api()) {
    setInterval(() => {
      api().syncRotateLogs();
    }, 24 * 60 * 60 * 1000);
  }

  console.log('[SyncEngine] Started.');
}

export function stopSyncEngine(): void {
  if (processingTimer) {
    clearTimeout(processingTimer);
    processingTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  if (holdCleanupTimer) {
    clearInterval(holdCleanupTimer);
    holdCleanupTimer = null;
  }
  engineStarted = false;
  console.log('[SyncEngine] Stopped.');
}

export function getDiagnostics(): SyncDiagnostics {
  return {
    status: _currentStatus,
    pendingChanges: 0, // Will be filled by useSync hook
    queueSize: 0,      // Will be filled by useSync hook
    lastSuccessfulSync: _lastSuccessfulSync,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
  };
}

export function getLastSuccessfulSync(): string | null {
  return _lastSuccessfulSync;
}

export function getCurrentStatus(): SyncDiagnostics['status'] {
  return _currentStatus;
}
