import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelmauliguesthouse.app',
  appName: 'HOTEL MAULI GUEST HOUSE',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
    },
    Preferences: {
      // Uses default localStorage bridge
    },
  },
  android: {
    backgroundColor: '#f5f7fa',
    allowMixedContent: true,
  },
};

export default config;
