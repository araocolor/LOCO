import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xlatin.app',
  appName: 'Xlatin',
  webDir: 'out',
  server: {
    url: 'https://xlatin.kr',
    cleartext: false,
    allowNavigation: ['*.supabase.co'],
  },
  ios: {
    appendUserAgent: 'XlatinApp',
    contentInset: 'always',
  },
};

export default config;
