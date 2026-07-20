import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  OnboardingProvider,
  useOnboarding,
  type OnboardingConfig,
} from './Onboarding';

export const meta: Meta<typeof OnboardingProvider> = {
  title: 'UI/Onboarding',
  component: OnboardingProvider,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0a1628' }],
    },
  },
};

type Story = StoryObj<typeof OnboardingProvider>;

// Demo app to show onboarding in action
function DemoApp() {
  const { startOnboarding, isActive, resetOnboarding } = useOnboarding();

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '40px',
        background: 'linear-gradient(135deg, #0a1628 0%, #1a2744 100%)',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
        }}
      >
        <h1 style={{ color: '#00d9ff', margin: 0 }} data-onboarding="dashboard">
          SC Fleet Manager
        </h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            data-onboarding="notifications"
            style={iconButtonStyle}
          >
            🔔
          </button>
          <button
            onClick={() => {
              resetOnboarding('demo-onboarding');
              startOnboarding();
            }}
            style={primaryButtonStyle}
            disabled={isActive}
          >
            {isActive ? 'Tour in progress...' : 'Start Tour'}
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ marginBottom: '40px', display: 'flex', gap: '16px' }}>
        <button style={navButtonStyle} data-onboarding="fleet-nav">
          🚀 Fleet
        </button>
        <button style={navButtonStyle} data-onboarding="trading-nav">
          📈 Trading
        </button>
        <button style={navButtonStyle}>📦 Logistics</button>
        <button style={navButtonStyle}>👥 Members</button>
        <button style={navButtonStyle}>⚙️ Settings</button>
      </nav>

      {/* Main content */}
      <main>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '24px',
          }}
        >
          <div style={cardStyle}>
            <h3 style={{ color: '#00d9ff', margin: '0 0 8px 0' }}>Total Ships</h3>
            <p style={{ color: '#e0e6ed', fontSize: '2rem', margin: 0 }}>127</p>
          </div>
          <div style={cardStyle}>
            <h3 style={{ color: '#00d9ff', margin: '0 0 8px 0' }}>Members</h3>
            <p style={{ color: '#e0e6ed', fontSize: '2rem', margin: 0 }}>45</p>
          </div>
          <div style={cardStyle}>
            <h3 style={{ color: '#00d9ff', margin: '0 0 8px 0' }}>Credits</h3>
            <p style={{ color: '#e0e6ed', fontSize: '2rem', margin: 0 }}>2.5M</p>
          </div>
          <div style={cardStyle}>
            <h3 style={{ color: '#00d9ff', margin: '0 0 8px 0' }}>Events</h3>
            <p style={{ color: '#e0e6ed', fontSize: '2rem', margin: 0 }}>8</p>
          </div>
        </div>
      </main>
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  background: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '8px',
  color: '#e0e6ed',
  cursor: 'pointer',
  fontSize: '1.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: 'rgba(0, 217, 255, 0.2)',
  border: '1px solid rgba(0, 217, 255, 0.3)',
  borderRadius: '8px',
  color: '#00d9ff',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: 500,
};

const navButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#8a9eb5',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const cardStyle: React.CSSProperties = {
  padding: '24px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
};

// Custom config for the demo
const demoConfig: OnboardingConfig = {
  id: 'demo-onboarding',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Star Citizen Fleet Manager! 🚀',
      content: (
        <>
          <p>
            Your command center for managing Star Citizen organizations, fleets, and operations.
          </p>
          <p>Let&apos;s take a quick tour to get you started.</p>
        </>
      ),
      position: 'center',
    },
    {
      id: 'dashboard',
      target: '[data-onboarding="dashboard"]',
      title: 'Your Dashboard',
      content: 'This is your central hub. View key metrics, quick actions, and live activity at a glance.',
      position: 'bottom',
    },
    {
      id: 'fleet',
      target: '[data-onboarding="fleet-nav"]',
      title: 'Fleet Management',
      content: "Manage your organization's ships, squadrons, and fleet composition here.",
      position: 'bottom',
    },
    {
      id: 'trading',
      target: '[data-onboarding="trading-nav"]',
      title: 'Trading & Routes',
      content: 'Plan profitable trading routes, track commodity prices, and optimize your logistics.',
      position: 'bottom',
    },
    {
      id: 'notifications',
      target: '[data-onboarding="notifications"]',
      title: 'Stay Updated',
      content: 'Real-time notifications keep you informed about fleet activities, trading opportunities, and more.',
      position: 'bottom-left',
    },
    {
      id: 'complete',
      title: "You're All Set! 🎉",
      content: (
        <>
          <p>You now know the basics of Star Citizen Fleet Manager.</p>
          <p>Explore the features and build your organization&apos;s success!</p>
        </>
      ),
      position: 'center',
      actionText: 'Get Started',
    },
  ],
  showProgress: true,
  allowSkip: true,
};

/**
 * Interactive onboarding demo
 * Click "Start Tour" to see the onboarding flow in action
 */
export const Interactive: Story = {
  render: () => (
    <OnboardingProvider defaultConfig={demoConfig}>
      <DemoApp />
    </OnboardingProvider>
  ),
};

/**
 * Auto-start example
 * The onboarding automatically starts when the page loads
 */
export const AutoStart: Story = {
  render: () => (
    <OnboardingProvider defaultConfig={demoConfig} autoStart>
      <DemoApp />
    </OnboardingProvider>
  ),
};

/**
 * No progress dots
 */
export const NoProgress: Story = {
  render: () => (
    <OnboardingProvider
      defaultConfig={{
        ...demoConfig,
        showProgress: false,
      }}
      autoStart
    >
      <DemoApp />
    </OnboardingProvider>
  ),
};

/**
 * No skip option
 */
export const NoSkip: Story = {
  render: () => (
    <OnboardingProvider
      defaultConfig={{
        ...demoConfig,
        allowSkip: false,
      }}
      autoStart
    >
      <DemoApp />
    </OnboardingProvider>
  ),
};

/**
 * Simple 2-step tour
 */
export const Simple: Story = {
  render: () => (
    <OnboardingProvider
      defaultConfig={{
        id: 'simple-onboarding',
        steps: [
          {
            id: 'welcome',
            title: 'Welcome!',
            content: 'This is a simple onboarding flow.',
            position: 'center',
          },
          {
            id: 'done',
            title: 'All Done!',
            content: 'You\'ve completed the quick tour.',
            position: 'center',
            actionText: 'Get Started',
          },
        ],
        showProgress: true,
        allowSkip: false,
      }}
      autoStart
    >
      <DemoApp />
    </OnboardingProvider>
  ),
};
