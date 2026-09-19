import React from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Settings, FileText, Smartphone, Database } from 'lucide-react';
import { pushMobileInvoiceSettingsToCloud } from '@/mobile/lib/mobileSyncActions';

const SettingsMobile: React.FC = () => {
  const invoiceSettings = useMobileStore(s => s.invoiceSettings);
  const updateInvoiceSettings = useMobileStore(s => s.updateInvoiceSettings);
  
  const isDev = useMobileStore(s => s.isDeveloperMode);
  const setDev = useMobileStore(s => s.setDeveloperMode);

  const toggleGST = async () => {
    const newVal = !(invoiceSettings?.gst_enabled ?? true);
    const updated = { ...invoiceSettings, gst_enabled: newVal };
    updateInvoiceSettings({ gst_enabled: newVal });
    await pushMobileInvoiceSettingsToCloud(updated);
  };

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* Header Info */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-4 items-start">
        <div className="p-2 bg-primary/20 rounded-lg text-primary">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">App Settings</h3>
          <p className="text-xs text-muted-foreground mt-1">Mobile settings sync automatically with Desktop. Complex tax configurations should be managed via Desktop.</p>
        </div>
      </div>

      {/* Tax Quick Settings */}
      <div className="bg-card border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 font-bold mb-2">
          <FileText className="w-4 h-4 text-primary" /> Tax Configuration
        </div>
        
        <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg border">
          <div>
            <h4 className="text-sm font-bold">GST Collection</h4>
            <p className="text-[10px] text-muted-foreground">Calculate GST on checkouts</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={invoiceSettings?.gst_enabled ?? true}
              onChange={toggleGST}
            />
            <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
        
        <div className="p-3 bg-secondary/30 rounded-lg border">
           <label className="text-xs font-bold text-muted-foreground block mb-1">Current GSTIN</label>
           <div className="font-mono text-sm">{invoiceSettings?.gst_number || 'Not Configured'}</div>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-card border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 font-bold mb-2">
          <Smartphone className="w-4 h-4 text-primary" /> Device & Sync
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="border p-2 rounded bg-secondary/30">
            <span className="text-muted-foreground block text-[10px] uppercase">Cloud Sync</span>
            <span className="font-bold text-status-available">Active</span>
          </div>
          <div className="border p-2 rounded bg-secondary/30">
            <span className="text-muted-foreground block text-[10px] uppercase">Local Store</span>
            <span className="font-bold">IndexedDB</span>
          </div>
        </div>

        <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg border mt-2">
          <div>
            <h4 className="text-sm font-bold text-destructive">Developer Mode</h4>
            <p className="text-[10px] text-muted-foreground">Pre-fill dummy data on forms</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={isDev}
              onChange={(e) => setDev(e.target.checked)}
            />
            <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-destructive"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SettingsMobile;
