import { useState, useEffect, useRef } from 'react';
import { Download, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { useStore } from '@/store/useStore';

/**
 * Centered modal & toast notification for auto-updates.
 * Mounts at root level (App.tsx) — always active throughout app lifecycle.
 *
 * Flow:
 * 1. Update detected: downloads automatically in background (shows progress).
 * 2. Update downloaded:
 *    - If checkout/billing is active: waits until idle (navigated away or closed).
 *    - If idle or at launch: shows short "Updating, app will restart" notice with 3s countdown,
 *      then triggers silent install and auto-relaunch.
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

type UpdateUiState = 'hidden' | 'downloading' | 'postponed' | 'restarting';

const UpdateNotification = () => {
  const [uiState, setUiState] = useState<UpdateUiState>('hidden');
  const [version, setVersion] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(3);
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);

  const currentSection = useStore((state) => state.currentSection);
  const isCheckoutOrBillingActive = currentSection === 'billing' || currentSection === 'registration';

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger the restart sequence
  const startRestartCountdown = () => {
    setUiState('restarting');
    setCountdown(3);

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    let secondsLeft = 3;
    countdownTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      setCountdown(secondsLeft);

      if (secondsLeft <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        window.electronAPI?.installUpdate();
      }
    }, 1000);
  };

  const handleRestartNow = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    window.electronAPI?.installUpdate();
  };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateAvailable) return;

    api.onUpdateAvailable((info) => {
      setVersion(info.version);
      setUiState('downloading');
    });

    api.onUpdateDownloadProgress((prog) => {
      setProgress(prog.percent);
      if (uiState !== 'downloading') {
        setUiState('downloading');
      }
    });

    api.onUpdateDownloaded((info) => {
      setVersion(info.version);
      setHasDownloaded(true);

      // Check whether user is actively in a billing/checkout flow
      const currentlyBusy = currentSection === 'billing' || currentSection === 'registration';
      if (currentlyBusy) {
        setUiState('postponed');
      } else {
        startRestartCountdown();
      }
    });

    api.onUpdateError(() => {
      // Keep UI clean, errors are logged to updater.log
      if (uiState === 'downloading') {
        setUiState('hidden');
      }
    });

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [currentSection]);

  // When an update has downloaded and the user was postponed, watch for when they leave billing/registration
  useEffect(() => {
    if (hasDownloaded && uiState === 'postponed' && !isCheckoutOrBillingActive) {
      startRestartCountdown();
    }
  }, [currentSection, hasDownloaded, uiState, isCheckoutOrBillingActive]);

  if (uiState === 'hidden') return null;

  return (
    <>
      {/* 1. Downloading Banner (Bottom Right) */}
      {uiState === 'downloading' && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-card border border-border shadow-2xl rounded-xl p-4 w-80 animate-fade-in"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Downloading Update v{version}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Installing automatically when ready...</p>
            </div>
            <span className="text-xs font-mono font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden mt-3">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Postponed Notice (Bottom Right) — when billing/checkout is active */}
      {uiState === 'postponed' && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-card border border-amber-500/50 shadow-2xl rounded-xl p-4 w-96 animate-fade-in"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Update v{version} Ready</p>
              <p className="text-xs text-muted-foreground mt-1">
                Checkout/Billing in progress. App will automatically restart to apply the update when you finish.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Restarting Notice Modal — when ready to install and idle */}
      {uiState === 'restarting' && (
        <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-primary/40 rounded-2xl shadow-2xl p-6 w-full max-w-md text-center space-y-5"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.1)' }}>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-500 animate-bounce" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">Updating to Version {version}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Update downloaded successfully. The application will restart automatically in{' '}
                <span className="font-bold text-primary text-base font-mono">{countdown}</span> seconds.
              </p>
            </div>

            <div className="p-3 bg-secondary/50 rounded-xl border border-border text-xs text-muted-foreground text-left">
              💡 All guest data, active bookings, and billing history are preserved safely in your SQLite database.
            </div>

            <div className="pt-2">
              <button
                onClick={handleRestartNow}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md active:scale-98"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                Restart Immediately ({countdown}s)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UpdateNotification;
