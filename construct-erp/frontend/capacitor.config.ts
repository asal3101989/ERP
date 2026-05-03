import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.bcim.app',
  appName: 'BCIM ERP',
  webDir: 'build',
  server: {
    url: 'https://app.bcim.in',
    cleartext: false
  }
};

export default config;
