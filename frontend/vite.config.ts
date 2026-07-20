import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

/** Map feature module paths to chunk names */
const FEATURE_CHUNKS: Array<[string, string | undefined]> = [
  ['/pages/Fleet.tsx', 'feature-fleet'],
  ['/services/fleetService', 'feature-fleet'],
  ['/pages/IntelVault', 'feature-intel'],
  ['/pages/IntelOfficer', 'feature-intel'],
  ['/services/intelVaultService', 'feature-intel'],
  // Activity services stay in default chunk (BaseService dependency)
  ['/services/activityService', undefined],
  ['/components/ActivityManagement', 'feature-activities'],
  ['/pages/ActivityDetail', 'feature-activities'],
];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      // Ignore tsconfig errors from other apps in the monorepo (e.g., mobile)
      ignoreConfigErrors: true,
    }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: false, // Use public/manifest.json directly
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
        // Only precache stable assets. JS/CSS have content hashes that change
        // every build — precaching them causes 404 "bad-precaching-response"
        // errors when a new SW installs after a deployment removed old chunks.
        // JS/CSS are instead handled via runtimeCaching below.
        globPatterns: ['**/*.{html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // navigateFallback disabled — nginx handles SPA routing via try_files.
        // Workbox navigateFallback causes PrecacheController errors when the
        // cached index.html is stale after a deployment.
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: { maxEntries: 150, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          // API responses are NOT cached by the service worker.
          // React Query handles client-side caching with proper invalidation
          // on mutations. SW caching caused stale data across all domains
          // (hangars, orgs, members, settings) because the SW cache + browser
          // HTTP cache (304/ETag) created a double-caching layer that served
          // stale GET responses after POST/PATCH mutations.
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react-is': path.resolve(__dirname, 'src/utils/reactIsShim.ts'),
      'hoist-non-react-statics': path.resolve(__dirname, 'src/utils/hoistPolyfill.ts'),
    },
    // Force deduplication of core React modules
    dedupe: ['react', 'react-dom', 'react-is'],
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Enable cookie forwarding for httpOnly cookies from backend
        // http-proxy will pass cookies through when changeOrigin is true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Circular dependency warnings from node_modules are third-party
        // internal cycles (d3-interpolate, recharts, @uiw/react-md-editor, etc.)
        // that we cannot fix. Suppress them.
        if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message?.includes('node_modules')) {
          return;
        }

        // Circular chunk warnings — should not occur with our simplified
        // chunking strategy. Log them prominently so we catch regressions.
        if (warning.code === 'CIRCULAR_CHUNK') {
          console.error(`CIRCULAR_CHUNK: ${warning.message}`);
          return;
        }

        // Application-code circular deps should be surfaced for action:
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          console.warn(`\u26A0\uFE0F  ${warning.code}: ${warning.message}`);
          return;
        }

        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          // Shims → vendor
          if (id.includes('/utils/reactIsShim') || id.includes('/utils/hoistPolyfill')) {
            return 'vendor';
          }
          // All node_modules → single vendor chunk (avoids circular chunk cycles)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // Admin feature sub-chunks
          if (id.includes('/src/pages/admin/components/')) {
            return 'admin';
          }
          // Application feature modules
          const featureMatch = FEATURE_CHUNKS.find(([pattern]) => id.includes(pattern));
          return featureMatch ? featureMatch[1] : undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1500, // Single vendor chunk will be large; raise limit
  },
  define: {
    // For compatibility with libraries that check process.env.NODE_ENV
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // Buffer polyfill for bip39 (browser-side encryption key generation)
    global: 'globalThis',
  },
  // Note: resolve is defined once above; avoid duplicates that override aliases.
  // Optimize dependency pre-bundling to fix React 19 + Adobe Spectrum SSRProvider issues
  optimizeDeps: {
    // Note: Removed Adobe Spectrum from include list since migration to MUI is complete.
    // Spectrum packages were causing @emotion/react pre-bundling issues with react-is initialization.
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-transition-group',
      '@mui/material',
      '@mui/icons-material',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      'zustand',
      'socket.io-client',
      'recharts',
      'axios',
      'zod',
      'buffer',
      'bip39',
    ],
    // react-is and hoist-non-react-statics are aliased to local shims,
    // so they should not be pre-bundled from node_modules
    exclude: ['react-is', 'hoist-non-react-statics'],
    esbuildOptions: {
      // Preserve module names to avoid circular dependency issues
      keepNames: true,
      // Target ESNext to avoid unnecessary transpilation
      target: 'esnext',
    },
  },
  // SSR configuration - explicitly disabled since we're not using server-side rendering
  ssr: {
    noExternal: [],
  },
});
