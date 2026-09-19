import { useState } from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  FileText, 
  Calendar, 
  History, 
  Settings, 
  Users,
  IndianRupee,
  LogOut
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { SectionType } from '@/types';
import { cn } from '@/lib/utils';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { APP_VERSION } from '@/constants/version';

const navItems: { id: SectionType; label: string; icon: typeof LayoutDashboard; color?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'registration', label: 'New Registration', icon: UserPlus },
  { id: 'billing', label: 'Billing', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'history', label: 'History', icon: History },
  { id: 'revenue', label: 'Revenue', icon: IndianRupee },
];

const adminItems: { id: SectionType; label: string; icon: typeof Settings; color: string }[] = [
  { id: 'admin', label: 'Admin Controls', icon: Settings, color: 'text-orange-300' },
  { id: 'staff', label: 'Staff & Salary', icon: Users, color: 'text-green-300' },
];

import { useShallow } from 'zustand/react/shallow';

const Sidebar = () => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { currentSection, setSection, setAuthenticated, currentUser, appRoles } = useStore(useShallow(state => ({
    currentSection: state.currentSection,
    setSection: state.setSection,
    setAuthenticated: state.setAuthenticated,
    currentUser: state.currentUser,
    appRoles: state.appRoles
  })));

  // Determine allowed permissions
  let allowedPermissions: SectionType[] | 'all' = [];
  if (currentUser === 'master') {
    allowedPermissions = 'all';
  } else if (currentUser && typeof currentUser === 'object' && currentUser.roleId) {
    const role = appRoles.find(r => r.id === currentUser.roleId);
    allowedPermissions = role ? role.permissions : [];
  } else {
    allowedPermissions = [];
  }

  const hasAccess = (sectionId: SectionType) => {
    if (allowedPermissions === 'all') return true;
    return allowedPermissions.includes(sectionId);
  };

  const filteredNavItems = navItems.filter(item => hasAccess(item.id));
  const filteredAdminItems = adminItems.filter(item => hasAccess(item.id));

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl z-20">
      {/* Header */}
      <div className="h-24 flex flex-col items-center justify-center border-b border-sidebar-accent bg-sidebar-accent p-2 text-center">
        <h1 className="font-bold text-lg tracking-wide uppercase">Hotel Mauli Guest House</h1>
        <p className="text-[10px] text-muted">J.R. Jaiswal (Proprietor)</p>
        <p className="text-[9px] text-muted/60 mt-0.5">v{APP_VERSION}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={cn(
              'nav-item',
              currentSection === item.id ? 'active' : ''
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="ml-3 font-medium">{item.label}</span>
          </button>
        ))}

        {filteredAdminItems.length > 0 && (
          <div className="border-t border-sidebar-border my-2 pt-2">
            <p className="px-4 text-xs font-semibold text-muted uppercase mb-2">Admin Controls</p>
            {filteredAdminItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  'nav-item',
                  item.color,
                  currentSection === item.id ? 'active' : ''
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="ml-3 font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Logout Button */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5" />
          <span className="ml-3 font-medium">Logout</span>
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Log Out"
        message="Are you sure you want to log out of Hotel Mauli Guest House?"
        confirmText="Log Out"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          setAuthenticated(false);
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </aside>
  );
};

export default Sidebar;
