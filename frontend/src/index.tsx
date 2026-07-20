// Initialize react-is shim before any other imports (required by @emotion/react)
import './utils/initReactIsShim';
// Buffer polyfill for bip39 encryption key generation (must load before bip39)
import './utils/initBufferPolyfill';
import './utils/legacySpectrumGlobals';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Last-resort error boundary that wraps the entire React tree.
 * If App itself crashes (e.g. corrupted localStorage, bad Zustand rehydration),
 * this prevents users from seeing a blank blue body background.
 * Uses inline styles because the MUI ThemeProvider may not be available.
 */
class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[RootErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  private readonly handleReload = () => {
    try {
      localStorage.removeItem('auth-storage');
      sessionStorage.clear();
    } catch {
      // Storage may be unavailable
    }
    globalThis.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Inline styles are intentional — this is a last-resort fallback that must
      // render even when the MUI theme / CSS pipeline is broken or unavailable.
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#0a1628',
            color: '#b0c4de',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>Something went wrong</h1>
          <p style={{ maxWidth: '500px', marginBottom: '1.5rem' }}>
            The application failed to load. This can happen due to cached data from an older
            version. Click below to clear local data and reload.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              background: '#00d9ff',
              color: '#0a1628',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Clear Data &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
