/**
 * UUID generation utility.
 * Replaces Date.now().toString() with cryptographically random UUIDs
 * to prevent ID collisions across Desktop and Android devices.
 */
export const generateUUID = (): string => {
  // crypto.randomUUID() is available in all modern browsers and Node 19+
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
