import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.CAP_SERVER_URL ??
  (process.env.CAP_LOCAL === '0' ? 'https://xlatin.kr' : 'http://127.0.0.1:3001');

const config: CapacitorConfig = {
  appId: 'com.xlatin.app',
  appName: 'Xlatin',
  webDir: 'out',
  initialFocus: false,
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    allowNavigation: ['*.supabase.co'],
  },
  ios: {
    appendUserAgent: 'XlatinApp',
    contentInset: 'never',
    initialFocus: false,
  },
};

export default config;
