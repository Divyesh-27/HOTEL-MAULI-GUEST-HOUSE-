import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 bg-background relative overflow-hidden flex flex-col">
        <Header />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
      {/* Print container - hidden on screen */}
      <div id="printable-area" className="hidden print:block" />
    </div>
  );
};

export default Layout;
