import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { useStore } from "./store/useStore";
import { ThemeProvider } from "./components/theme-provider";
import AppMobile from "./mobile/AppMobile";
import UpdateNotification from "./components/UpdateNotification";

const queryClient = new QueryClient();

// Detect if running inside Capacitor on a native platform
const isMobilePlatform = (): boolean => {
  try {
    // Check Capacitor global
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    // Fallback: check for Capacitor platform flag
    if ((window as any).Capacitor?.getPlatform?.() === 'android') return true;
  } catch {}
  // Also check if there's no electronAPI (meaning not on desktop) AND screen is narrow
  // This allows browser testing of mobile layout
  if (!(window as any).electronAPI && window.innerWidth <= 500) return true;
  return false;
};

const AppContent = () => {
  // If on mobile platform, render mobile app entirely
  if (isMobilePlatform()) {
    return <AppMobile />;
  }

  // Desktop Electron app
  const isAuthenticated = useStore(state => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <HashRouter> 
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
};

const App = () => (
  <ThemeProvider defaultTheme="light" attribute="class">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateNotification />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;