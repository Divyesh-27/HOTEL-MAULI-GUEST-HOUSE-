import { createRoot } from "react-dom/client";
import AppMobile from "./mobile/AppMobile.tsx";
import App from "./App.tsx";
import "./index.css";

/**
 * Desktop detection — must work in BOTH dev AND packaged Electron builds.
 *
 * CORRECT APPROACH:
 *   1. Default to Desktop layout in standard browsers (`npm run dev`) and Electron.
 *   2. Switch to Mobile layout if `window.Capacitor` is present (Android APK) 
 *      or `?mode=mobile` is explicitly in the URL (for browser testing).
 *   3. `?mode=desktop` allows forcing desktop if needed.
 */
const isMobileEnvironment = !!(window as any).Capacitor || window.location.search.includes("mode=mobile");
const isDesktopMode: boolean = window.location.search.includes("mode=desktop") || !isMobileEnvironment;

createRoot(document.getElementById("root")!).render(
  isDesktopMode ? <App /> : <AppMobile />
);
