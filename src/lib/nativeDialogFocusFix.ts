/**
 * Electron on Windows: after a native window.alert / confirm / prompt closes,
 * the page can lose keyboard focus — inputs can't be typed into or text-selected
 * (only mouse-driven spinner arrows still work) until the window is re-activated.
 *
 * Wrap the three native dialogs once, app-wide, so every existing call site
 * restores focus afterwards. Dialog appearance and return values are unchanged.
 */
export function installNativeDialogFocusFix(): void {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.refocusWindow) return; // browser / dev without Electron: nothing to fix

  const refocus = () => {
    try {
      api.refocusWindow?.();
    } catch {
      /* ignore */
    }
  };

  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  const nativePrompt = window.prompt.bind(window);

  window.alert = (message?: unknown) => {
    try {
      nativeAlert(message as string);
    } finally {
      refocus();
    }
  };

  window.confirm = (message?: string) => {
    try {
      return nativeConfirm(message);
    } finally {
      refocus();
    }
  };

  window.prompt = (message?: string, defaultValue?: string) => {
    try {
      return nativePrompt(message, defaultValue);
    } finally {
      refocus();
    }
  };
}
