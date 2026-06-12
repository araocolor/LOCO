import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xlatin.app',
  appName: 'Xlatin',
  webDir: 'out',
  server: {
    url: 'https://xlatin.kr?app=1',
    cleartext: false,
    allowNavigation: ['*.supabase.co'],
  },
};

export default config;
