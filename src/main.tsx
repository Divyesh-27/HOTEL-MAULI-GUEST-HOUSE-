import { createRoot } from "react-dom/client";
import AppMobile from "./mobile/AppMobile.tsx";
import App from "./App.tsx";
import "./index.css";

/**
 * Desktop detection — must work in BOTH dev AND packaged Electron builds.
 *
 * WHY NOT `?mode=desktop`:
 *   In a packaged Electron build the entry is loaded via loadFile() which
 *   uses a bare file:// URL with no query string, so
 *   window.location.search is always "". That check always evaluated to
 *   false, causing AppMobile to render every time in the installed app.
 *
 * CORRECT APPROACH:
 *   1. `window.electronAPI` — injected exclusively by preload.cjs via
 *      contextBridge. Present in every Electron window (dev + packaged).
 *      Absent in Capacitor/browser.
 *   2. Fallback `?mode=desktop` URL param — kept for manual browser
 *      testing of the desktop layout without Electron.
 */
const isDesktopMode: boolean =
  !!(window as any).electronAPI ||
  window.location.search.includes("mode=desktop");

createRoot(document.getElementById("root")!).render(
  isDesktopMode ? <App /> : <AppMobile />
);
