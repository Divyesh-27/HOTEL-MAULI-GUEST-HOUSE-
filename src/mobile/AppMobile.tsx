import React, { useEffect } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { startMobileSyncEngine, stopMobileSyncEngine, refreshFromCloud } from '@/mobile/lib/mobileSyncEngine';

import HeaderMobile from '@/mobile/components/HeaderMobile';
import BottomTabs from '@/mobile/components/BottomTabs';
import OfflineBanner from '@/mobile/components/OfflineBanner';
import PullToRefreshWrapper from '@/mobile/components/PullToRefreshWrapper';
import BottomSheet from '@/mobile/components/BottomSheet';
import { Clock, BarChart3, Settings, Users, Wrench, LogOut, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import IndexMobile from '@/mobile/pages/IndexMobile';
import DashboardMobile from '@/mobile/sections/DashboardMobile';
import RegistrationMobile from '@/mobile/sections/RegistrationMobile';
import BillingMobile from '@/mobile/sections/BillingMobile';
import CalendarMobile from '@/mobile/sections/CalendarMobile';
import HistoryMobile from '@/mobile/sections/HistoryMobile';
import AdminMobile from '@/mobile/sections/AdminMobile';
import RevenueMobile from '@/mobile/sections/RevenueMobile';
import StaffMobile from '@/mobile/sections/StaffMobile';
import SettingsMobile from '@/mobile/sections/SettingsMobile';

import LoginMobile from '@/mobile/pages/LoginMobile';

const AppMobile: React.FC = () => {
  const isAuthenticated = useMobileStore((s) => s.isAuthenticated);
  const currentSection = useMobileStore(s => s.currentSection);
  const setSection = useMobileStore(s => s.setSection);
  const moreMenuOpen = useMobileStore(s => s.moreMenuOpen);
  const setMoreMenuOpen = useMobileStore(s => s.setMoreMenuOpen);
  const logout = useMobileStore(s => s.logout);

  useEffect(() => {
    if (isAuthenticated) {
      // 1. Hook up online/offline listeners & perform initial pull
      startMobileSyncEngine();
      
      return () => {
        stopMobileSyncEngine();
      };
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginMobile />;
  }

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard': return <DashboardMobile />;
      case 'registration': return <RegistrationMobile />;
      case 'billing': return <BillingMobile />;
      case 'calendar': return <CalendarMobile />;
      case 'history': return <HistoryMobile />;
      case 'revenue': return <RevenueMobile />;
      case 'admin': return <AdminMobile />;
      case 'staff': return <StaffMobile />;
      case 'settings': return <SettingsMobile />;
      default: return <DashboardMobile />;
    }
  };

  const moreMenuItems = [
    { id: 'history' as const, icon: Clock, label: 'History' },
    { id: 'revenue' as const, icon: BarChart3, label: 'Revenue' },
    { id: 'admin' as const, icon: Settings, label: 'Admin Controls' },
    { id: 'staff' as const, icon: Users, label: 'Staff & Salary' },
    { id: 'settings' as const, icon: Wrench, label: 'Settings / Sync Status' },
  ];

  return (
    <div className="mobile-layout h-[100dvh] w-screen overflow-hidden flex flex-col bg-background text-foreground">
      <OfflineBanner />
      
      {/* Header takes natural height */}
      <div className="shrink-0 z-10">
        <HeaderMobile />
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 min-h-0 relative z-0">
        <PullToRefreshWrapper>
          <div className="p-4 h-full relative overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="h-full"
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </div>
        </PullToRefreshWrapper>
      </main>

      {/* Bottom Tabs takes natural height */}
      <div className="shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-lg pb-safe z-10">
        <BottomTabs />
      </div>

      {/* More menu bottom sheet */}
      <BottomSheet
        open={moreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        title="More"
      >
        <div className="space-y-0">
          {moreMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                className="more-menu-item w-full text-left rounded-lg"
                onClick={() => {
                  setSection(item.id);
                  setMoreMenuOpen(false);
                }}
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className={isActive ? 'text-primary font-semibold' : ''}>{item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-auto" />
              </button>
            );
          })}

          {/* Divider */}
          <div className="border-t border-border my-2" />

          {/* Logout */}
          <button
            className="more-menu-item w-full text-left rounded-lg text-destructive"
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                logout();
              }
            }}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-semibold">Logout</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default AppMobile;
