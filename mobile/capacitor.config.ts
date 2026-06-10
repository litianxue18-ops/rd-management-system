import type { CapacitorConfig } from '@capacitor/cli';

// App 直接加载部署在服务器上的 Next.js 站点 (SSR, 无法静态导出).
// 改服务器代码即生效, App 壳本身极少需要重新出包.
const serverUrl = process.env.RD_MOBILE_SERVER_URL || 'http://116.62.4.84';

const config: CapacitorConfig = {
  appId: 'com.reedom.rdsystem',
  appName: '研发管理',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: true, // 服务器目前是 HTTP (无 HTTPS), 必须允许明文
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#2563eb',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#2563eb',
    },
  },
};

export default config;
