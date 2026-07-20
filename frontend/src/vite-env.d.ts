/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_ENCRYPTION_KEY_SEED: string;
  readonly VITE_ENABLE_SANDBOX_LOGIN?: string;
  readonly VITE_ENABLE_LIVE_DEMO_GUIDE?: string;
  readonly NODE_ENV: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
