import { useStore } from '@/store/useStore';
import { ThemeToggle } from '../theme-toggle';
import { useSync } from '@/hooks/useSync';
import { Cloud, CloudUpload, CloudOff } from 'lucide-react';
import { APP_VERSION } from '@/constants/version';
import { toast } from 'sonner';

const sectionTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  registration: 'New Registration',
  billing: 'Billing',
  calendar: 'Calendar',
  history: 'History',
  revenue: 'Revenue',
  admin: 'Admin Controls',
  staff: 'Staff & Salary',
};

const Header = () => {
  const currentSection = useStore(state => state.currentSection);
  const { isSyncing, lastSynced, syncError, executeSync, isConnected } = useSync();

  const currentDate = (() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  })();

  const handleSyncClick = () => {
    if (!isConnected) {
      toast.info("Cloud sync is offline — running in local-only mode.");
    }
    executeSync();
  };

  return (
    <header className="h-16 bg-card shadow-sm flex items-center justify-between px-8 z-10 border-b border-border">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground animate-fade-in" key={currentSection}>
          {sectionTitles[currentSection]}
        </h2>
        {currentSection === 'dashboard' && (
          <span className="text-xs text-muted-foreground">Made by DIVYESH_27</span>
        )}
      </div>
      <div className="flex items-center gap-6 text-right">
        {/* Sync Status Button */}
        <div className="flex flex-col items-center justify-center mr-2">
          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className={`p-2 rounded-full border transition-colors ${
              isSyncing ? 'bg-secondary animate-pulse border-border' :
              syncError ? 'bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20' :
              'bg-secondary border-border hover:bg-secondary/80 text-primary'
            }`}
            title={syncError ? `Sync Error: ${syncError}` : lastSynced ? `Last Synced: ${lastSynced.toLocaleTimeString()}` : 'Click to Sync'}
          >
            {isSyncing ? <CloudUpload className="h-5 w-5" /> : (!isConnected || syncError) ? <CloudOff className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
          </button>
          {lastSynced && !syncError && <span className="text-[9px] text-muted-foreground mt-0.5">Synced {lastSynced.getHours()}:{lastSynced.getMinutes().toString().padStart(2, '0')}</span>}
          {!isConnected && !syncError && <span className="text-[9px] text-orange-500 mt-0.5">Offline</span>}
        </div>

        <ThemeToggle />
        <div>
          <p className="font-bold text-foreground text-sm">HOTEL MAULI GUEST HOUSE {APP_VERSION}</p>
          <p className="text-xs text-muted-foreground">Divyesh Jaiswal {APP_VERSION} | Divyesh | {currentDate}</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
