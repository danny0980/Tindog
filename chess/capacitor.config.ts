import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chessarena.app',
  appName: 'Chess Arena',
  webDir: 'dist',
  backgroundColor: '#0b0d12',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // The app hides the launch screen itself once it has drawn (src/native/shell.ts).
    SplashScreen: { launchAutoHide: false, backgroundColor: '#0b0d12', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0b0d12', overlaysWebView: false },
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#0b0d12',
  },
}

export default config
