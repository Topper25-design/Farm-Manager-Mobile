import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.farmmanager.app',
  appName: 'FarmManagerMobile',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config; 