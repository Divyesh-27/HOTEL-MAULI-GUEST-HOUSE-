import { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react';

/**
 * Floating notification banner for auto-updates.
 * Mounts at root level (App.tsx) — always visible regardless of active page.
 * 
 * States:
 *   - hidden:      no update activity
 *   - downloading: update detected, downloading in background (shows progress)
 *   - ready:       update downloaded, offers "Restart Now" / "Later"
 */

// Extend window type for electronAPI
declare global {
  interface Window {
    electronAPI?: {
      checkForUpdates: () => Promise<{ success: boolean; version?: string; error?: string }>;
      installUpdate: () => void;
      onUpdateChecking: (cb: () => void) => void;
      onUpdateAvailable: (cb: (info: { version: string; releaseDate?: string }) => void) => void;
      onUpdateNotAvailable: (cb: (info: { version: string }) => void) => void;
      onUpdateDownloadProgress: (cb: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => void;
      onUpdateDownloaded: (cb: (info: { version: string; releaseDate?: string }) => void) => void;
      onUpdateError: (cb: (err: { message: string }) => void) => void;
      removeUpdateListeners: () => void;
      [key: string]: any;
    };
  }
}

type UpdateState = 'hidden' | 'downloading' | 'ready';

const UpdateNotification = () => {
  const [state, setState] = useState<UpdateState>('hidden');
  const [version, setVersion] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateAvailable) return;

    api.onUpdateAvailable((info) => {
      setVersion(info.version);
      setState('downloading');
      setDismissed(false);
    });

    api.onUpdateDownloadProgress((prog) => {
      setProgress(prog.percent);
    });

    api.onUpdateDownloaded((info) => {
      setVersion(info.version);
      setState('ready');
      setDismissed(false);
    });

    // Cleanup listeners on unmount
    return () => {
      api.removeUpdateListeners?.();
    };
  }, []);

  const handleRestart = () => {
    window.electronAPI?.installUpdate();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Don't render if hidden or dismissed
  if (state === 'hidden' || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-fade-in" style={{ animationDuration: '300ms' }}>
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4 max-w-sm backdrop-blur-sm"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.1)' }}>
        
        {/* Downloading State */}
        {state === 'downloading' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Downloading Update</p>
                <p className="text-xs text-muted-foreground truncate">
                  Version {version} is downloading…
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right font-mono">{progress}%</p>
          </div>
        )}

        {/* Ready State */}
        {state === 'ready' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Update Ready</p>
                <p className="text-xs text-muted-foreground">
                  Version {version} has been downloaded.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Later"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestart}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-all shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restart Now
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                Later
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Update will install on next app restart.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateNotification;
