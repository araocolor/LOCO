import type { CapacitorConfig } from '@capacitor/cli';

const localServerUrl = process.env.CAP_LOCAL_URL ?? 'http://127.0.0.1:3001';
const serverUrl =
  process.env.CAP_SERVER_URL ??
  (process.env.CAP_LOCAL === '1' ? localServerUrl : 'https://xlatin.kr');

const config: CapacitorConfig = {
  appId: 'com.xlatin.app',
  appName: 'Xlatin',
  webDir: 'out',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    allowNavigation: ['*.supabase.co'],
  },
  ios: {
    appendUserAgent: 'XlatinApp',
  },
};

export default config;
