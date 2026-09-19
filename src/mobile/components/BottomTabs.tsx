import React from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Home, UserPlus, CalendarDays, CreditCard, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileDock } from '@/components/ui/apple-dock';

const BottomTabs: React.FC = () => {
  const currentSection = useMobileStore((s) => s.currentSection);
  const setSection = useMobileStore((s) => s.setSection);
  const setMoreMenuOpen = useMobileStore((s) => s.setMoreMenuOpen);
  const moreMenuOpen = useMobileStore((s) => s.moreMenuOpen);

  const tabs = [
    { id: 'dashboard' as const, icon: Home, label: 'Dashboard' },
    { id: 'registration' as const, icon: UserPlus, label: 'Register' },
    { id: 'calendar' as const, icon: CalendarDays, label: 'Calendar' },
    { id: 'billing' as const, icon: CreditCard, label: 'Billing' },
    { id: 'more' as const, icon: MoreHorizontal, label: 'More' },
  ];

  const moreSections = ['history', 'revenue', 'admin', 'staff', 'settings'];

  const activeId =
    currentSection === 'more' || moreMenuOpen || moreSections.includes(currentSection)
      ? 'more'
      : currentSection;

  return (
    <div className="w-full">
      <MobileDock 
        items={tabs}
        activeId={activeId}
        onItemClick={(id) => {
          if (id === 'more') {
            setMoreMenuOpen(!moreMenuOpen);
          } else {
            setSection(id);
            setMoreMenuOpen(false);
          }
        }}
      />
    </div>
  );
};

export default BottomTabs;
