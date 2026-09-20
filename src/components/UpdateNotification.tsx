import { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';

/**
 * Centered modal notification for auto-updates.
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
  const currentSection = useStore((state) => state.currentSection);

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

  // Only show the modal on dashboard or calendar to prevent blocking active flows (e.g. checkout/registration)
  if (currentSection !== 'dashboard' && currentSection !== 'calendar') return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" style={{ animationDuration: '300ms' }}>
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.1)' }}>
        
        {/* Downloading State */}
        {state === 'downloading' && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Download className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div className="flex-1 min-w-0 mt-1">
                <p className="text-lg font-bold text-foreground">Downloading Update</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Version {version} is downloading…
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden mt-2">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-right font-mono">{progress.toFixed(1)}%</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleDismiss}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                Hide
              </button>
            </div>
          </div>
        )}

        {/* Ready State */}
        {state === 'ready' && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0 mt-1">
                <p className="text-lg font-bold text-foreground">Update Ready to Install</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Version {version} has been downloaded and is ready to be installed.
                </p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border">
              To apply the new update, the application needs to be restarted. You can restart now or install it later.
            </p>
            
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleRestart}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                Restart Now
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-3 border border-border rounded-lg font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                Not Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateNotification;
