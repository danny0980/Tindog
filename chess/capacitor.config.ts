import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chessarena.app',
  appName: 'Chess Arena',
  webDir: 'dist',
  backgroundColor: '#0b0d12',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#0b0d12',
  },
}

export default config
