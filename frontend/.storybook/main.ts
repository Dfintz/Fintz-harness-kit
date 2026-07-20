import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-onboarding',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation',
  },
  typescript: {
    // IMPORTANT: react-docgen-typescript causes TDZ errors in Storybook + Vite
    // because the injected __docgenInfo code references component names that may
    // be renamed/out-of-scope after esbuild transformation.
    // See: https://github.com/storybookjs/storybook/issues/25247
    reactDocgen: 'react-docgen',
  },
  viteFinal: async (config) => {
    // ── Resolve aliases ──────────────────────────────────────────────
    // CRITICAL: react-is and hoist-non-react-statics shims MUST be aliased
    // so @emotion/react uses our lightweight ESM shim instead of the real
    // react-is package (which has CJS/ESM interop issues causing TDZ errors).
    //
    // Storybook's Vite builder may pass config.resolve.alias as an ARRAY
    // (Vite array format: [{find, replacement}]) or as an object.
    // We normalize to array format to safely merge our aliases.
    config.resolve = config.resolve || {};

    const newAliases = [
      { find: '@', replacement: path.resolve(__dirname, '../src') },
      { find: 'react-is', replacement: path.resolve(__dirname, '../src/utils/reactIsShim.ts') },
      { find: 'hoist-non-react-statics', replacement: path.resolve(__dirname, '../src/utils/hoistPolyfill.ts') },
    ];

    if (Array.isArray(config.resolve.alias)) {
      // Array format: push our entries (they take precedence at end)
      config.resolve.alias = [...config.resolve.alias, ...newAliases];
    } else {
      // Object format: convert to array so we can mix both
      const existing = Object.entries(config.resolve.alias || {}).map(
        ([find, replacement]) => ({ find, replacement: replacement as string })
      );
      config.resolve.alias = [...existing, ...newAliases];
    }

    config.resolve.dedupe = [
      ...(config.resolve.dedupe || []),
      'react',
      'react-dom',
      'react-is',
    ];

    // ── optimizeDeps ─────────────────────────────────────────────────
    // Storybook dev mode uses Vite's esbuild pre-bundling (NOT Rollup
    // manualChunks).  We INCLUDE @emotion/react so esbuild resolves it
    // together with React in one pass.  The react-is alias above routes
    // to our shim during pre-bundling automatically.
    //
    // IMPORTANT: @storybook/react-vite loads the main vite.config.ts
    // first, which has optimizeDeps.exclude for react-is, etc.
    // We CLEAR those excludes to prevent the "entry point cannot be
    // marked as external" esbuild error.
    config.optimizeDeps = config.optimizeDeps || {};
    config.optimizeDeps.include = [
      ...(config.optimizeDeps.include || []),
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@mui/material',
      '@mui/material/styles',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      '@emotion/is-prop-valid',
      'react-transition-group',
    ];
    config.optimizeDeps.exclude = [];

    // ── Strip manualChunks from inherited Rollup config ──────────────
    // The main vite.config.ts defines manualChunks for the production
    // build.  In Storybook dev mode these can cause chunk-level TDZ.
    if (config.build?.rollupOptions?.output) {
      const out = config.build.rollupOptions.output;
      if (Array.isArray(out)) {
        out.forEach((o) => { delete (o as Record<string, unknown>).manualChunks; });
      } else {
        delete (out as Record<string, unknown>).manualChunks;
      }
    }

    return config;
  },
};

export default config;
