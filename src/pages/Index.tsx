import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/components/sections/Dashboard';
import Registration from '@/components/sections/Registration';
import Billing from '@/components/sections/Billing';
import Calendar from '@/components/sections/Calendar';
import History from '@/components/sections/History';
import Revenue from '@/components/sections/Revenue';
import Admin from '@/components/sections/Admin';
import Staff from '@/components/sections/Staff';

const Index = () => {
  const { currentSection, currentUser, appRoles, logout } = useStore(useShallow(state => ({
    currentSection: state.currentSection,
    currentUser: state.currentUser,
    appRoles: state.appRoles,
    logout: state.logout
  })));

  // SEC-03: Explicit RBAC logic. A null or undefined currentUser NEVER falls through to 'all' permissions.
  const isMaster = currentUser === 'master';
  const isValidUser = !isMaster && currentUser && typeof currentUser === 'object' && Boolean(currentUser.roleId);

  useEffect(() => {
    if (!isMaster && !isValidUser) {
      console.warn('[RBAC] Unauthorized null or invalid currentUser session detected. Forcing logout.');
      logout();
    }
  }, [isMaster, isValidUser, logout]);

  let allowedPermissions: import('@/types').SectionType[] | 'all' = [];
  if (isMaster) {
    allowedPermissions = 'all';
  } else if (isValidUser) {
    const role = appRoles.find(r => r.id === currentUser.roleId);
    allowedPermissions = role ? role.permissions : [];
  } else {
    allowedPermissions = [];
  }

  const hasAccess = (sectionId: import('@/types').SectionType) => {
    if (allowedPermissions === 'all') return true;
    return Array.isArray(allowedPermissions) && allowedPermissions.includes(sectionId);
  };

  if (!isMaster && !isValidUser) {
    return null;
  }

  const renderSection = () => {
    const sectionToRender = hasAccess(currentSection) ? currentSection : 'dashboard';

    switch (sectionToRender) {
      case 'dashboard':
        return <Dashboard />;
      case 'registration':
        return <Registration />;
      case 'billing':
        return <Billing />;
      case 'calendar':
        return <Calendar />;
      case 'history':
        return <History />;
      case 'revenue':
        return <Revenue />;
      case 'admin':
        return <Admin />;
      case 'staff':
        return <Staff />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout>
      {renderSection()}
    </Layout>
  );
};

export default Index;
